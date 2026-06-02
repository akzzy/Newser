import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { sources } from './src/config/sources.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function syncSources() {
  console.log('Syncing sources to database...');
  
  for (const source of sources) {
    const { error } = await supabase
      .from('sources')
      .upsert({
        name: source.name,
        slug: source.slug,
        feed_url: source.feed_url,
        website_url: source.website_url,
        logo_url: source.logo_url,
        color: source.color,
        category: source.category,
        fetch_method: source.fetch_method,
        is_active: source.is_active || false
      }, { onConflict: 'slug' });
      
    if (error) {
      console.error(`Error syncing ${source.name}:`, error.message);
    } else {
      console.log(`Synced: ${source.name}`);
    }
  }
  
  console.log('Done.');
}

syncSources();
