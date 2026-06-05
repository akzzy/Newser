import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from current directory
dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOldWordCounts() {
  const sourcesToCheck = [
    'AP News', 'CBS Sports', 'Wired', 'TechCrunch', 'Reuters', 
    '9to5Google', 'Variety', 'The Next Web', 'Autosport F1', 
    'The Verge', 'Android Authority'
  ];

  console.log("Fetching sources...");
  const { data: sources, error: sourceErr } = await supabase.from('sources').select('id, name').in('name', sourcesToCheck);
  
  if (sourceErr) {
    console.error("Error fetching sources:", sourceErr);
    return;
  }
  
  console.log(`Checking articles from 24-48 hours ago for ${sources.length} sources...`);
  
  const results = [];
  
  const yesterdayStart = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const yesterdayEnd = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  for (const source of sources) {
    const { data: articles, error: artErr } = await supabase
      .from('articles')
      .select('title, original_content, is_scraped, published_at')
      .eq('source_id', source.id)
      .gte('published_at', yesterdayStart)
      .lte('published_at', yesterdayEnd)
      .order('published_at', { ascending: false })
      .limit(1);
      
    if (artErr) {
      console.error(`Error fetching for ${source.name}:`, artErr);
      continue;
    }
    
    if (articles && articles.length > 0) {
      const art = articles[0];
      const text = art.original_content || '';
      
      const charCount = text.length;
      const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
      
      results.push({
        Source: source.name,
        "Pub Date": new Date(art.published_at).toLocaleString(),
        "Chars": charCount,
        "Words": wordCount,
        "Scraped?": art.is_scraped ? 'Yes' : 'No (RSS)'
      });
    } else {
      results.push({
        Source: source.name,
        "Pub Date": 'N/A',
        "Chars": 0,
        "Words": 0,
        "Scraped?": 'No Articles Found'
      });
    }
  }
  
  console.table(results);
}

checkOldWordCounts();
