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

async function checkUrl() {
  const url = 'https://www.wired.com/story/made-in-china-tiktok-never-dies/';
  console.log("Checking database for URL:", url);
  
  const { data, error } = await supabase
    .from('articles')
    .select('id, title, url, original_content, is_scraped, published_at')
    .eq('url', url);
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  if (data && data.length > 0) {
    const art = data[0];
    console.log("FOUND IT:");
    console.log("Title:", art.title);
    console.log("Pub Date:", art.published_at);
    console.log("Is Scraped:", art.is_scraped);
    console.log("Chars:", art.original_content?.length || 0);
  } else {
    console.log("NOT FOUND IN DATABASE!");
  }
  
  // Now let's check what the actual latest wired article is!
  const { data: wired } = await supabase.from('sources').select('id').eq('slug', 'wired').single();
  if (wired) {
    const { data: latest } = await supabase
      .from('articles')
      .select('title, url, published_at, is_scraped')
      .eq('source_id', wired.id)
      .order('published_at', { ascending: false })
      .limit(3);
    console.log("\nThe actual 3 newest Wired articles in the DB are:");
    console.table(latest);
  }
}

checkUrl();
