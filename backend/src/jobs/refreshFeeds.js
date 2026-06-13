import cron from 'node-cron';
import { sources } from '../config/sources.js';
import { fetchFeed } from '../services/feedFetcher.js';
import { scrapeArticle, pingScraper } from '../services/scraper.js';
import { rewriteArticle } from '../services/aiRewriter.js';
import { checkDuplicate } from '../services/deduplicator.js';

/**
 * Sleep helper.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Shared NVIDIA Rate-Limit Lock ──
// Both the Deduplicator (fetch job) and the Rewriter (rewrite job) call NVIDIA.
// This cooperative lock ensures they never overlap and exceed the 40 RPM limit.
let nvidiaLockHolder = null;  // 'fetch' | 'rewrite' | null
let fetchWaiting = false;     // Signal for rewriter to yield

function acquireNvidiaLock(holder) {
  if (nvidiaLockHolder) return false;
  nvidiaLockHolder = holder;
  return true;
}

function releaseNvidiaLock(holder) {
  if (nvidiaLockHolder === holder) nvidiaLockHolder = null;
}

/**
 * Fetch job uses this to request priority access to NVIDIA.
 * Sets fetchWaiting=true so the rewriter knows to pause,
 * then waits until the rewriter releases the lock.
 */
async function acquireNvidiaLockForFetch(logger) {
  if (acquireNvidiaLock('fetch')) return; // Got it immediately
  
  fetchWaiting = true;
  logger.info('[NvidiaLock] Fetch job waiting for rewriter to yield...');
  while (nvidiaLockHolder === 'rewrite') {
    await sleep(1000); // Poll every 1s
  }
  nvidiaLockHolder = 'fetch';
  fetchWaiting = false;
  logger.info('[NvidiaLock] Fetch job acquired NVIDIA lock.');
}

/**
 * Rewriter checks this before each article.
 * If the fetch job is waiting, it yields the lock and pauses.
 */
async function yieldIfFetchWaiting(logger) {
  if (!fetchWaiting) return;
  
  logger.info('[NvidiaLock] Rewriter yielding to fetch job...');
  releaseNvidiaLock('rewrite');
  
  // Wait until fetch job finishes its dedup phase
  while (fetchWaiting || nvidiaLockHolder === 'fetch') {
    await sleep(1000);
  }
  
  // Re-acquire lock and resume
  nvidiaLockHolder = 'rewrite';
  logger.info('[NvidiaLock] Rewriter resumed after fetch job completed.');
}

/**
 * Fetch articles from a single source and attach source metadata.
 * Returns raw articles without storing anything.
 */
async function fetchSourceArticles(supabase, source, logger) {
  logger.info(`[RefreshFeeds] Fetching ${source.name}...`);

  // 1. Resolve source ID from database
  const { data: sourceRow, error: srcErr } = await supabase
    .from('sources')
    .select('id')
    .eq('slug', source.slug)
    .single();

  if (srcErr || !sourceRow) {
    logger.warn(`[RefreshFeeds] Source "${source.name}" query failed or not found, skipping. Error: ${srcErr?.message || 'No row found'}`);
    return [];
  }

  // 2. Fetch RSS feed
  const articles = await fetchFeed(source);
  if (articles.length === 0) {
    logger.info(`[RefreshFeeds] No articles from ${source.name}`);
    return [];
  }

  logger.info(`[RefreshFeeds] Fetched ${articles.length} articles from ${source.name}`);

  // Attach source_id to each article for later DB insertion
  return articles.map(a => ({ ...a, source_id: sourceRow.id }));
}

/**
 * Rewrite pending/failed articles with AI.
 * Processes in small batches with delays to respect rate limits.
 */
async function rewritePendingArticles(supabase, logger, limit = 10) {
  // Only rewrite articles from the last 24 hours
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Alert system for old stuck articles
  const { count: stuckCount, error: stuckErr } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .in('rewrite_status', ['pending', 'failed'])
    .lt('published_at', cutoff);

  if (!stuckErr && stuckCount > 0) {
    // Check if we already alerted about this recently to avoid spamming the dashboard every 15 minutes
    const { data: existingAlerts } = await supabase
      .from('system_alerts')
      .select('id')
      .eq('type', 'ai_error')
      .eq('is_resolved', false)
      .ilike('message', '%stuck in pending%')
      .limit(1);

    if (!existingAlerts || existingAlerts.length === 0) {
      await supabase.from('system_alerts').insert({
        type: 'ai_error',
        message: `There are ${stuckCount} articles older than 24 hours that are stuck in pending/failed AI rewrite.`
      });
    }
  }

  const { data: pendingArticles, error } = await supabase
    .from('articles')
    .select('id, title, original_content, url, image_url, source_id, rewrite_status')
    .in('rewrite_status', ['pending', 'failed'])
    .gte('published_at', cutoff)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error(`[AIRewrite] Error fetching pending articles: ${error.message}`);
    return { successCount: 0, failedCount: 0 };
  }

  if (!pendingArticles || pendingArticles.length === 0) {
    logger.info('[AIRewrite] No pending articles to rewrite');
    return { successCount: 0, failedCount: 0 };
  }

  logger.info(`[AIRewrite] Processing ${pendingArticles.length} pending articles...`);

  let successCount = 0;
  for (let i = 0; i < pendingArticles.length; i++) {
    const article = pendingArticles[i];
    logger.info(`[AIRewrite] ${i + 1}/${pendingArticles.length}: "${article.title.substring(0, 60)}..."`);

    let finalContent = article.original_content;
    let finalImageUrl = article.image_url;

    // Scrape the full article page before passing to AI
    try {
      logger.info(`[AIRewrite] Scraping full content from: ${article.url}`);
      const scraped = await scrapeArticle(article.url);
      if (scraped && scraped.content && scraped.content.length > 100) {
        finalContent = scraped.content;
        
        // If the scraper found an image and we didn't have one from RSS, save it
        if (scraped.image_url && !article.image_url) {
          finalImageUrl = scraped.image_url;
        }
      } else {
        // Scraper returned no usable content
        const nextFailStatus = article.rewrite_status === 'pending' ? 'failed' : 'permanently_failed';
        logger.warn(`[AIRewrite] Scraper returned no content for "${article.title.substring(0, 50)}". Marking ${nextFailStatus}.`);
        await supabase.from('articles').update({ rewrite_status: nextFailStatus }).eq('id', article.id);
        continue;
      }
    } catch (err) {
      // Scraper threw (404, timeout, parse error)
      const nextFailStatus = article.rewrite_status === 'pending' ? 'failed' : 'permanently_failed';
      logger.warn(`[AIRewrite] Scraper failed for "${article.title.substring(0, 50)}": ${err.message}. Marking ${nextFailStatus}.`);
      await supabase.from('articles').update({ rewrite_status: nextFailStatus }).eq('id', article.id);
      continue;
    }

    let aiResult = null;
    try {
      aiResult = await rewriteArticle(article.title, finalContent, logger);
    } catch (err) {
      logger.error(`[AIRewrite] Failed for "${article.title}": ${err.message}`);
      
      // Log to system alerts dashboard
      await supabase.from('system_alerts').insert({
        type: 'ai_error',
        message: `AI Rewrite failed for "${article.title}": ${err.message}`,
        source_id: article.source_id
      });
      
      // Mark as failed so we can retry later (or drop after 2 tries)
      const nextFailStatus = article.rewrite_status === 'pending' ? 'failed' : 'permanently_failed';
      await supabase
        .from('articles')
        .update({ rewrite_status: nextFailStatus })
        .eq('id', article.id);
        
      // Increment failed count and move to next article
      if (i < pendingArticles.length - 1) {
        await sleep(5000);
      }
      continue;
    }

    if (aiResult) {
      const { error: updateErr } = await supabase
        .from('articles')
        .update({
          title_hook: aiResult.title_hook,
          deep_dive_content: aiResult.deep_dive_content,
          ai_category: aiResult.ai_category,
          ai_tags: aiResult.ai_tags,
          read_time: aiResult.read_time,
          image_url: finalImageUrl,
          rewrite_status: 'completed',
          rewritten_at: new Date().toISOString()
        })
        .eq('id', article.id);

      if (updateErr) {
        logger.error(`[AIRewrite] Update error: ${updateErr.message}`);
      } else {
        successCount++;
      }
    }

    // Brief delay between articles
    if (i < pendingArticles.length - 1) {
      await sleep(2000);
      // Cooperative yielding: pause if fetch job needs NVIDIA for dedup
      await yieldIfFetchWaiting(logger);
    }
  }

  logger.info(`[AIRewrite] Completed: ${successCount}/${pendingArticles.length} articles rewritten`);
  return { successCount, failedCount: pendingArticles.length - successCount };
}

/**
 * Full refresh cycle: fetch ALL sources → pool → deduplicate globally → store → rewrite.
 *
 * This "pool-first" architecture ensures cross-source duplicates are caught
 * even when two sources publish the same story. All articles from all feeds
 * are collected in memory first, then deduplicated as a single batch against
 * each other AND against existing DB articles, before anything is written.
 */
export async function refreshAllFeeds(fastify) {
  const startTime = Date.now();
  const supabase = fastify.supabase;
  const logger = fastify.log;

  // ── Database Lock: Prevent concurrent instances (cPanel Passenger spawns multiple workers) ──
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: activeRuns } = await supabase
    .from('cron_runs')
    .select('id')
    .gte('started_at', thirtyMinsAgo)
    .is('completed_at', null)
    .limit(1);

  if (activeRuns && activeRuns.length > 0) {
    logger.warn('[RefreshFeeds] ⚠️ Another cron process is already running. Skipping this instance to prevent duplicates.');
    return;
  }

  // Acquire lock
  const { data: lockRecord, error: lockErr } = await supabase
    .from('cron_runs')
    .insert({ started_at: new Date(startTime).toISOString() })
    .select('id')
    .single();

  if (lockErr || !lockRecord) {
    logger.error(`[RefreshFeeds] Failed to acquire lock: ${lockErr?.message || 'Unknown error'}`);
    return;
  }

  fastify.log.info('[RefreshFeeds] Starting feed refresh cycle (Lock Acquired)...');

  // Fetch DB sources to map source_id to name for logging
  const { data: dbSources } = await supabase.from('sources').select('id, name');
  const dbSourceIdToName = new Map((dbSources || []).map(s => [s.id, s.name]));

  // Ping scraper microservice to prevent Render from putting it to sleep
  pingScraper().catch(() => {});

  // ── Phase 1: Fetch all feeds into a single article pool ──
  const activeSources = sources.filter(s => s.is_active);
  let allFetched = [];
  
  const cycleStats = {
    started_at: new Date(startTime).toISOString(),
    total_fetched: 0,
    total_new_urls: 0,
    total_inserted: 0,
    duplicates_dropped: 0,
    ai_rewritten: 0,
    ai_failed: 0,
    source_breakdown: {
      scraper_stats: { attempted: 0, succeeded: 0 }
    }
  };

  for (const source of activeSources) {
    try {
      const articles = await fetchSourceArticles(supabase, source, logger);
      cycleStats.source_breakdown[source.name] = { fetched: articles.length, inserted: 0 };
      allFetched = allFetched.concat(articles);
    } catch (error) {
      logger.error(`[RefreshFeeds] Error fetching ${source.name}: ${error.message}`);
    }
  }

  cycleStats.total_fetched = allFetched.length;

  if (allFetched.length === 0) {
    logger.info('[RefreshFeeds] No articles fetched from any source.');
    await supabase.from('cron_runs').update({ completed_at: new Date().toISOString() }).eq('id', lockRecord.id);
    return;
  }

  logger.info(`[RefreshFeeds] Phase 1 done: ${allFetched.length} total articles fetched from ${activeSources.length} sources`);

  // ── Phase 1.5: In-memory URL deduplication ──
  // Prevents the exact same URL appearing multiple times in the same batch from spamming logs
  const uniqueUrls = new Set();
  const dedupedFetched = [];
  for (const article of allFetched) {
    if (article.url && uniqueUrls.has(article.url)) continue;
    if (article.url) uniqueUrls.add(article.url);
    dedupedFetched.push(article);
  }
  allFetched = dedupedFetched;

  // ── Phase 1.6: Age filter — drop articles older than 24 hours ──
  const maxAgeMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const freshArticles = allFetched.filter(article => {
    if (!article.published_at) return true; // keep if no date (can't tell)
    const age = now - new Date(article.published_at).getTime();
    return age <= maxAgeMs;
  });
  const staleDropped = allFetched.length - freshArticles.length;
  if (staleDropped > 0) {
    logger.info(`[RefreshFeeds] Phase 1.6: Dropped ${staleDropped} articles older than 24h`);
  }
  allFetched = freshArticles;

  // ── Phase 2: Exact URL deduplication against DB ──
  const urls = allFetched.map(a => a.url).filter(Boolean);
  const existingUrls = new Set();
  
  // Chunk URLs into batches of 50 to prevent Supabase 'Bad Request' (URI Too Long) errors
  const chunkSize = 50;
  for (let i = 0; i < urls.length; i += chunkSize) {
    const chunk = urls.slice(i, i + chunkSize);
    const { data: existingArticles, error } = await supabase
      .from('articles')
      .select('url')
      .in('url', chunk);
      
    if (error) {
      logger.error(`[RefreshFeeds] Phase 2 DB Error: ${error.message}`);
      continue;
    }
    
    if (existingArticles) {
      existingArticles.forEach(a => existingUrls.add(a.url));
    }
  }

  const newArticles = allFetched.filter(a => a.url && !existingUrls.has(a.url));
  cycleStats.total_new_urls = newArticles.length;

  if (newArticles.length === 0) {
    logger.info('[RefreshFeeds] No new articles (all URLs already in DB).');
    // Release lock and return — the independent rewrite job handles pending articles
    await supabase.from('cron_runs').update({ completed_at: new Date().toISOString() }).eq('id', lockRecord.id);
    return;
  }

  logger.info(`[RefreshFeeds] ${newArticles.length} new articles after URL dedup`);

  // ── Phase 3: Semantic title deduplication (cross-source + against DB) ──
  // Acquire NVIDIA lock (with priority — rewriter will yield if running)
  await acquireNvidiaLockForFetch(logger);

  const uniqueArticles = [];
  let skippedCount = 0;

  try {
  // Fetch recent articles from DB to compare against
  const cutoffTime = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  const { data: recentDbArticles } = await supabase
    .from('articles')
    .select('id, title, source_id')
    .gte('published_at', cutoffTime);

  // Start with DB articles as the known-unique set
  const knownTitles = (recentDbArticles || []).map(a => a.title);
  const dbTitleToId = new Map((recentDbArticles || []).map(a => [a.title, a.id]));
  const dbTitleToSourceId = new Map((recentDbArticles || []).map(a => [a.title, a.source_id]));

  // Fetch recent duplicate logs (up to 7 days, managed by cleanup) to avoid re-evaluating or re-ingesting manually deleted articles
  const { data: recentLogs } = await supabase
    .from('duplicate_logs')
    .select('dropped_title');
  const previouslyDroppedTitles = new Set((recentLogs || []).map(l => l.dropped_title));

  // Sort by published_at ascending so the earliest article wins
  newArticles.sort((a, b) => new Date(a.published_at) - new Date(b.published_at));

  for (const article of newArticles) {
    if (previouslyDroppedTitles.has(article.title)) {
      continue; // Already dropped in a previous cron run, skip completely
    }

    const result = await checkDuplicate(article.title, knownTitles, logger);

    if (result.isDuplicate) {
      skippedCount++;
      cycleStats.duplicates_dropped++;
      logger.info(`[RefreshFeeds] Dropping duplicate (${result.method}, score: ${result.score.toFixed(2)}): "${article.title}" ↔ "${result.matchedTitle}"`);
      
      const droppedSource = dbSourceIdToName.get(article.source_id) || 'Unknown';
      
      let matchedSourceId = dbTitleToSourceId.get(result.matchedTitle);
      if (!matchedSourceId) {
        // Find it in the in-memory array
        const inMemoryMatch = uniqueArticles.find(a => a.title === result.matchedTitle);
        if (inMemoryMatch) matchedSourceId = inMemoryMatch.source_id;
      }
      const matchedSource = dbSourceIdToName.get(matchedSourceId) || 'Unknown';

      // Log to DB for admin dashboard
      await supabase.from('duplicate_logs').insert({
        dropped_title: article.title,
        matched_title: result.matchedTitle,
        method: result.method,
        score: result.score,
        dropped_source: droppedSource,
        matched_source: matchedSource
      });
      
      // Add to set to prevent logging this exact title again in the same batch
      previouslyDroppedTitles.add(article.title);

      // Increment importance_score of the original matched article
      if (dbTitleToId.has(result.matchedTitle)) {
        // It's already in the DB
        const articleId = dbTitleToId.get(result.matchedTitle);
        const { data: match } = await supabase.from('articles').select('importance_score').eq('id', articleId).single();
        if (match) {
          await supabase.from('articles').update({ importance_score: (match.importance_score || 1) + 1 }).eq('id', articleId);
        }
      } else {
        // It's in the current batch waiting to be inserted
        const inMemoryMatch = uniqueArticles.find(a => a.title === result.matchedTitle);
        if (inMemoryMatch) {
          inMemoryMatch.importance_score = (inMemoryMatch.importance_score || 1) + 1;
        }
      }
    } else {
      // New article gets default importance of 1
      article.importance_score = 1;
      uniqueArticles.push(article);
      knownTitles.push(article.title);
    }
  }

  logger.info(`[RefreshFeeds] Phase 3 done: ${uniqueArticles.length} unique articles, ${skippedCount} semantic duplicates dropped`);
  } finally {
    // Always release NVIDIA lock — dedup is done (or crashed), rewriter can resume
    releaseNvidiaLock('fetch');
  }

  // Cleanup old duplicate logs (> 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('duplicate_logs').delete().lt('created_at', sevenDaysAgo);

  if (uniqueArticles.length === 0) {
    logger.info('[RefreshFeeds] No unique articles to store.');
    await supabase.from('cron_runs').update({ completed_at: new Date().toISOString() }).eq('id', lockRecord.id);
    return;
  }

  // ── Phase 4: Scrape articles with insufficient content or missing images ──
  for (const article of uniqueArticles) {
    article.is_scraped = false; // Default
    
    // Check character count as requested (1000 characters)
    const charCount = article.original_content ? article.original_content.length : 0;
    
    if (charCount < 1000 || !article.image_url) {
      cycleStats.source_breakdown.scraper_stats.attempted++;
      try {
        const source = activeSources.find(s => s.id === article.source_id);
        const scraped = await scrapeArticle(article.url, source);
        if (scraped.content.length > article.original_content.length) {
          article.original_content = scraped.content;
          article.is_scraped = true; // Mark as successfully scraped
          cycleStats.source_breakdown.scraper_stats.succeeded++;
        }
        // Always prefer the scraped image (og:image) as it is usually high-res, 
        // whereas RSS feeds often provide tiny pixelated thumbnails
        if (scraped.image_url) {
          article.image_url = scraped.image_url;
        }
      } catch (err) {
        logger.error(`[RefreshFeeds] Scrape error for "${article.title}": ${err.message}`);
        
        // Skip routine failures (like image galleries) to avoid spamming the UI
        if (!err.message.includes('Could not extract sufficient content')) {
          await supabase.from('system_alerts').insert({
            type: 'scraper_error',
            message: `Failed to scrape "${article.title}": ${err.message}`,
            source_id: article.source_id
          });
        }
      }
    }
  }

  // ── Phase 5: Store unique articles ──
  let insertedCount = 0;
  for (const article of uniqueArticles) {
    const { error: insertErr } = await supabase
      .from('articles')
      .upsert({
        source_id: article.source_id,
        title: article.title,
        original_content: article.original_content,
        url: article.url,
        image_url: article.image_url,
        author: article.author,
        published_at: article.published_at,
        fetched_at: new Date().toISOString(),
        rewrite_status: 'pending',
        is_scraped: article.is_scraped,
        importance_score: article.importance_score || 1
      }, { onConflict: 'url' });

    if (insertErr) {
      logger.error(`[RefreshFeeds] Insert error: ${insertErr.message}`);
    } else {
      insertedCount++;
      const sourceName = dbSourceIdToName.get(article.source_id);
      if (sourceName && cycleStats.source_breakdown[sourceName]) {
        cycleStats.source_breakdown[sourceName].inserted++;
      }
    }
  }
  
  cycleStats.total_inserted = insertedCount;

  logger.info(`[RefreshFeeds] Phase 5 done: ${insertedCount} new articles stored`);

  // Fetch job is done — update lock record (no more Phase 6 here)
  cycleStats.completed_at = new Date().toISOString();
  
  await supabase
    .from('cron_runs')
    .update(cycleStats)
    .eq('id', lockRecord.id);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`[RefreshFeeds] Fetch cycle complete. ${insertedCount} stored, ${skippedCount} duplicates dropped in ${elapsed}s`);
}

// ── Independent Rewrite Job ──

let rewriteJobRunning = false;

/**
 * Independent rewrite job that runs on its own schedule.
 * Picks up pending/failed articles and rewrites them with AI.
 * Cooperatively yields to the fetch job when it needs NVIDIA for dedup.
 */
async function rewriteJob(fastify) {
  const logger = fastify.log;
  const supabase = fastify.supabase;

  // Simple in-memory lock to prevent overlapping rewrite cycles
  if (rewriteJobRunning) {
    return;
  }

  // Check if fetch job needs NVIDIA — if so, skip this cycle entirely
  if (fetchWaiting || nvidiaLockHolder === 'fetch') {
    logger.info('[RewriteJob] Fetch job is using NVIDIA, skipping this cycle.');
    return;
  }

  rewriteJobRunning = true;

  try {
    // Acquire NVIDIA lock for rewriting
    if (!acquireNvidiaLock('rewrite')) {
      logger.info('[RewriteJob] NVIDIA lock held, skipping.');
      return;
    }

    const rewriteStats = await rewritePendingArticles(supabase, logger, 50);
    
    if (rewriteStats.successCount > 0 || rewriteStats.failedCount > 0) {
      logger.info(`[RewriteJob] Cycle done: ${rewriteStats.successCount} rewritten, ${rewriteStats.failedCount} failed`);
    }
  } catch (err) {
    logger.error(`[RewriteJob] Error: ${err.message}`);
  } finally {
    releaseNvidiaLock('rewrite');
    rewriteJobRunning = false;
  }
}

/**
 * Start both cron jobs: Fetch (every 15 min) + Rewrite (every 5 min).
 */
export function startCronJobs(fastify) {
  const fetchInterval = parseInt(process.env.REFRESH_INTERVAL || '15', 10);
  const rewriteInterval = 5; // minutes

  // ── Fetch Job: Initial run after short delay ──
  setTimeout(() => {
    fastify.log.info('[RefreshFeeds] Running initial feed refresh...');
    refreshAllFeeds(fastify).catch(err => {
      fastify.log.error(`[RefreshFeeds] Initial refresh failed: ${err.message}`);
    });
  }, 3000);

  // ── Fetch Job: Periodic schedule ──
  cron.schedule(`*/${fetchInterval} * * * *`, () => {
    refreshAllFeeds(fastify).catch(err => {
      fastify.log.error(`[RefreshFeeds] Scheduled refresh failed: ${err.message}`);
    });
  });

  // ── Rewrite Job: Initial run after 30s (let fetch job go first) ──
  setTimeout(() => {
    fastify.log.info('[RewriteJob] Running initial rewrite cycle...');
    rewriteJob(fastify).catch(err => {
      fastify.log.error(`[RewriteJob] Initial rewrite failed: ${err.message}`);
    });
  }, 30000);

  // ── Rewrite Job: Periodic schedule ──
  cron.schedule(`*/${rewriteInterval} * * * *`, () => {
    rewriteJob(fastify).catch(err => {
      fastify.log.error(`[RewriteJob] Scheduled rewrite failed: ${err.message}`);
    });
  });

  fastify.log.info(`[CronJobs] Fetch: every ${fetchInterval} min | Rewrite: every ${rewriteInterval} min`);
}

/**
 * Manual refresh trigger (for API endpoint).
 */
export async function triggerManualRefresh(fastify) {
  return refreshAllFeeds(fastify);
}
