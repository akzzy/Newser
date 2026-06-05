import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { extract } from '@extractus/article-extractor';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  // 1. Get all active sources
  const { data: sources, error: sourceError } = await supabase
    .from('sources')
    .select('id, name, feed_url')
    .eq('is_active', true);

  if (sourceError) {
    console.error("Failed to fetch sources", sourceError);
    return;
  }

  console.log(`Found ${sources.length} active sources. Testing the latest article for each...`);

  for (const source of sources) {
    // 2. Get the latest article for this source
    const { data: articles, error: articleError } = await supabase
      .from('articles')
      .select('id, title, url')
      .eq('source_id', source.id)
      .order('published_at', { ascending: false })
      .limit(1);

    if (articleError || !articles || articles.length === 0) {
      console.log(`[${source.name}] No articles found.`);
      continue;
    }

    const article = articles[0];
    console.log(`\nTesting Source: ${source.name}`);
    console.log(`URL: ${article.url}`);

    try {
      const startTime = Date.now();
      const extracted = await extract(article.url);
      const duration = Date.now() - startTime;

      if (!extracted || !extracted.content) {
        console.log(`-> FAILED: Extractor returned null or empty content.`);
      } else {
        const charCount = extracted.content.length;
        if (charCount > 1000) {
          console.log(`-> SUCCESS: Extracted ${charCount} chars in ${duration}ms!`);
        } else {
          console.log(`-> WARNING: Extracted only ${charCount} chars. It might be blocked or just a short snippet.`);
        }
      }
    } catch (err) {
      console.log(`-> ERROR: ${err.message}`);
    }
  }
}

runTest();
