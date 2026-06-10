import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { fetchFeed } from './src/services/feedFetcher.js';
import { sources } from './src/config/sources.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
  console.log('--- STARTING CLEAN SLATE OPERATION ---');
  
  // 1. Fetch all active sources from DB to get their IDs
  const { data: activeSources, error: sourceErr } = await supabase
    .from('sources')
    .select('*')
    .eq('is_active', true);
    
  if (sourceErr) throw sourceErr;
  
  console.log(`1. Fetching current articles from ${sources.length} configured feeds...`);
  
  // 2. Fetch feeds directly from the config
  const allFetched = [];
  await Promise.all(sources.map(async (source) => {
    try {
      const dbSource = activeSources.find(s => s.slug === source.slug);
      if (!dbSource) return; // Skip if not active in DB
      
      const articles = await fetchFeed(source);
      for (const a of articles) {
        a.source_id = dbSource.id;
      }
      allFetched.push(...articles);
    } catch (err) {
      console.warn(`Failed to fetch ${source.name}: ${err.message}`);
    }
  }));
  
  console.log(`   Found ${allFetched.length} total articles across all feeds.`);
  
  // 3. Insert them into DB if they don't exist (Phase 2 & 5)
  // We just insert them directly as 'completed' so they are ignored forever
  const urls = allFetched.map(a => a.url).filter(Boolean);
  
  // Chunk the DB select if there are many URLs to avoid URI too long errors
  const existingUrls = new Set();
  for (let i = 0; i < urls.length; i += 200) {
    const chunk = urls.slice(i, i + 200);
    const { data: existingArticles } = await supabase
      .from('articles')
      .select('url')
      .in('url', chunk);
    if (existingArticles) {
      for (const a of existingArticles) existingUrls.add(a.url);
    }
  }
  
  const newArticles = allFetched.filter(a => a.url && !existingUrls.has(a.url));
  
  // Deduplicate in-memory to prevent unique constraint errors
  const uniqueNew = [];
  const seenNewUrls = new Set();
  for (const a of newArticles) {
    if (!seenNewUrls.has(a.url)) {
      seenNewUrls.add(a.url);
      uniqueNew.push({
        source_id: a.source_id,
        title: a.title,
        url: a.url,
        original_content: a.original_content,
        image_url: a.image_url,
        published_at: a.published_at || new Date().toISOString(),
        rewrite_status: 'completed', // MARK AS IGNORED IMMEDIATELY
      });
    }
  }
  
  if (uniqueNew.length > 0) {
    console.log(`2. Inserting ${uniqueNew.length} never-before-seen feed articles straight to 'ignored'...`);
    
    // Batch insert
    for (let i = 0; i < uniqueNew.length; i += 100) {
      const batch = uniqueNew.slice(i, i + 100);
      const { error } = await supabase.from('articles').insert(batch);
      if (error) console.error('Insert error:', error.message);
    }
  } else {
    console.log(`2. No new articles in feeds to ignore.`);
  }
  
  // 4. Update all current pending/failed articles in DB to 'completed'
  console.log(`3. Clearing out all pending/failed backlog in the database...`);
  const { data: updated, error: updateErr } = await supabase
    .from('articles')
    .update({ rewrite_status: 'completed' })
    .in('rewrite_status', ['pending', 'failed'])
    .select('id');
    
  if (updateErr) {
    console.error('Update error:', updateErr.message);
  } else {
    console.log(`   Marked ${updated?.length || 0} existing backlog articles as ignored.`);
  }
  
  console.log('--- CLEAN SLATE COMPLETE ---');
  console.log('Next time the cronjob runs, it will ONLY pick up brand new articles!');
}

run().catch(console.error);
