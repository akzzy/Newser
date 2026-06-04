import cron from 'node-cron';
import { sources } from '../config/sources.js';
import { fetchFeed } from '../services/feedFetcher.js';
import { scrapeArticle } from '../services/scraper.js';
import { rewriteArticle } from '../services/aiRewriter.js';
import { checkDuplicate } from '../services/deduplicator.js';

/**
 * Sleep helper.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

  const { data: pendingArticles, error } = await supabase
    .from('articles')
    .select('id, title, original_content')
    .in('rewrite_status', ['pending', 'failed'])
    .gte('published_at', cutoff)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error(`[AIRewrite] Error fetching pending articles: ${error.message}`);
    return 0;
  }

  if (!pendingArticles || pendingArticles.length === 0) {
    logger.info('[AIRewrite] No pending articles to rewrite');
    return 0;
  }

  logger.info(`[AIRewrite] Processing ${pendingArticles.length} pending articles...`);

  let successCount = 0;
  for (let i = 0; i < pendingArticles.length; i++) {
    const article = pendingArticles[i];
    logger.info(`[AIRewrite] ${i + 1}/${pendingArticles.length}: "${article.title.substring(0, 60)}..."`);

    const aiResult = await rewriteArticle(article.title, article.original_content);

    if (aiResult) {
      const { error: updateErr } = await supabase
        .from('articles')
        .update({
          title_hook: aiResult.title_hook,
          deep_dive_content: aiResult.deep_dive_content,
          ai_category: aiResult.ai_category,
          ai_tags: aiResult.ai_tags,
          read_time: aiResult.read_time,
          rewrite_status: 'completed',
          rewritten_at: new Date().toISOString()
        })
        .eq('id', article.id);

      if (updateErr) {
        logger.error(`[AIRewrite] Update error: ${updateErr.message}`);
      } else {
        successCount++;
      }
    } else {
      // Mark as failed so we can retry later
      await supabase
        .from('articles')
        .update({ rewrite_status: 'failed' })
        .eq('id', article.id);
    }

    // 5-second delay between requests (~12 RPM, under Gemini's 15 RPM free tier limit)
    if (i < pendingArticles.length - 1) {
      await sleep(5000);
    }
  }

  logger.info(`[AIRewrite] Completed: ${successCount}/${pendingArticles.length} articles rewritten`);
  return successCount;
}

/**
 * Full refresh cycle: fetch ALL sources → pool → deduplicate globally → store → rewrite.
 *
 * This "pool-first" architecture ensures cross-source duplicates are caught
 * even when two sources publish the same story. All articles from all feeds
 * are collected in memory first, then deduplicated as a single batch against
 * each other AND against existing DB articles, before anything is written.
 */
async function refreshAllFeeds(fastify) {
  const startTime = Date.now();
  fastify.log.info('[RefreshFeeds] Starting feed refresh cycle...');

  const supabase = fastify.supabase;
  const logger = fastify.log;

  // Fetch DB sources to map source_id to name for logging
  const { data: dbSources } = await supabase.from('sources').select('id, name');
  const dbSourceIdToName = new Map((dbSources || []).map(s => [s.id, s.name]));

  // ── Phase 1: Fetch all feeds into a single article pool ──
  const activeSources = sources.filter(s => s.is_active);
  let allFetched = [];

  for (const source of activeSources) {
    try {
      const articles = await fetchSourceArticles(supabase, source, logger);
      allFetched = allFetched.concat(articles);
    } catch (error) {
      logger.error(`[RefreshFeeds] Error fetching ${source.name}: ${error.message}`);
    }
  }

  if (allFetched.length === 0) {
    logger.info('[RefreshFeeds] No articles fetched from any source.');
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

  // ── Phase 2: Exact URL deduplication against DB ──
  const urls = allFetched.map(a => a.url).filter(Boolean);
  const { data: existingArticles } = await supabase
    .from('articles')
    .select('url')
    .in('url', urls);

  const existingUrls = new Set((existingArticles || []).map(a => a.url));
  const newArticles = allFetched.filter(a => a.url && !existingUrls.has(a.url));

  if (newArticles.length === 0) {
    logger.info('[RefreshFeeds] No new articles (all URLs already in DB).');
    // Still run AI rewriter for any pending articles
    await rewritePendingArticles(supabase, logger, 50);
    return;
  }

  logger.info(`[RefreshFeeds] ${newArticles.length} new articles after URL dedup`);

  // ── Phase 3: Semantic title deduplication (cross-source + against DB) ──
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
  const uniqueArticles = [];
  let skippedCount = 0;

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

  // Cleanup old duplicate logs (> 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('duplicate_logs').delete().lt('created_at', sevenDaysAgo);

  if (uniqueArticles.length === 0) {
    logger.info('[RefreshFeeds] No unique articles to store.');
    await rewritePendingArticles(supabase, logger, 50);
    return;
  }

  // ── Phase 4: Scrape articles with insufficient content or missing images ──
  for (const article of uniqueArticles) {
    article.is_scraped = false; // Default
    if (article.original_content.length < 200 || !article.image_url) {
      try {
        const source = activeSources.find(s => s.id === article.source_id);
        const scraped = await scrapeArticle(article.url, source);
        if (scraped.content.length > article.original_content.length) {
          article.original_content = scraped.content;
          article.is_scraped = true; // Mark as successfully scraped
        }
        // Always prefer the scraped image (og:image) as it is usually high-res, 
        // whereas RSS feeds often provide tiny pixelated thumbnails
        if (scraped.image_url) {
          article.image_url = scraped.image_url;
        }
      } catch (err) {
        logger.error(`[RefreshFeeds] Scrape error for "${article.title}": ${err.message}`);
        await supabase.from('system_alerts').insert({
          type: 'scraper_error',
          message: `Failed to scrape "${article.title}": ${err.message}`,
          source_id: article.source_id
        });
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
    }
  }

  logger.info(`[RefreshFeeds] Phase 5 done: ${insertedCount} new articles stored`);

  // ── Phase 6: Rewrite pending articles with AI ──
  const rewriteCount = await rewritePendingArticles(supabase, logger, 50);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`[RefreshFeeds] Cycle complete. ${insertedCount} stored, ${rewriteCount} rewritten, ${skippedCount} duplicates dropped in ${elapsed}s`);
}

/**
 * Start the cron job for periodic feed refreshing.
 */
export function startCronJobs(fastify) {
  const interval = parseInt(process.env.REFRESH_INTERVAL || '15', 10);

  // Run initial refresh after a short delay to let the server stabilize
  setTimeout(() => {
    fastify.log.info('[RefreshFeeds] Running initial feed refresh...');
    refreshAllFeeds(fastify).catch(err => {
      fastify.log.error(`[RefreshFeeds] Initial refresh failed: ${err.message}`);
    });
  }, 3000);

  // Schedule periodic refresh
  cron.schedule(`*/${interval} * * * *`, () => {
    refreshAllFeeds(fastify).catch(err => {
      fastify.log.error(`[RefreshFeeds] Scheduled refresh failed: ${err.message}`);
    });
  });

  fastify.log.info(`[RefreshFeeds] Cron scheduled: every ${interval} minutes`);
}

/**
 * Manual refresh trigger (for API endpoint).
 */
export async function triggerManualRefresh(fastify) {
  return refreshAllFeeds(fastify);
}
