import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { scrapeArticle } from './src/services/scraper.js';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function testScraper() {
  console.log("Fetching up to 10 recently failed articles (is_scraped = false)...");
  
  // Get 10 articles that failed to scrape recently
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, url, title, source_id, original_content, is_scraped')
    .eq('is_scraped', false)
    .not('url', 'ilike', '%variety%')
    .order('published_at', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error("Error fetching articles:", error);
    return;
  }
  
  console.log(`Found ${articles.length} articles to re-scrape.\n`);
  
  const { data: sources, error: sourcesErr } = await supabase.from('sources').select('id, content_selector');
  const sourcesList = sources || [];
  
  let successes = 0;
  
  for (const article of articles) {
    console.log(`Testing: ${article.title}`);
    console.log(`URL: ${article.url}`);
    
    // Check if it's actually short (some might be from RSS feeds that provide full text)
    const charCount = article.original_content ? article.original_content.length : 0;
    if (charCount >= 1000) {
       console.log(`-> Skipping, already has ${charCount} chars (probably full RSS text).`);
       console.log("------------------------");
       continue;
    }
    
    const sourceConfig = sourcesList.find(s => s.id === article.source_id);
    
    try {
      const startTime = Date.now();
      const scraped = await scrapeArticle(article.url, sourceConfig);
      const duration = Date.now() - startTime;
      
      console.log(`-> SUCCESS! Extracted ${scraped.content.length} chars in ${duration}ms.`);
      
      if (scraped.content.length > charCount) {
        // Update the DB
        await supabase.from('articles').update({
          original_content: scraped.content,
          is_scraped: true,
          rewrite_status: 'pending' // Re-trigger AI rewrite with full content
        }).eq('id', article.id);
        console.log(`-> Database updated.`);
        successes++;
      }
    } catch (err) {
      console.error(`-> FAILED: ${err.message}`);
    }
    console.log("------------------------");
  }
  
  console.log(`\nTest complete! Successfully re-scraped ${successes} articles.`);
}

testScraper();
