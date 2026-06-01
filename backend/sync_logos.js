import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { sources } from './src/config/sources.js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function syncLogos() {
  console.log('Syncing logo URLs to Supabase...');
  for (const src of sources) {
    const { error } = await supabase
      .from('sources')
      .update({ logo_url: src.logo_url })
      .eq('slug', src.slug);
      
    if (error) {
      console.error(`Failed to update ${src.name}:`, error.message);
    } else {
      console.log(`Updated ${src.name}`);
    }
  }
  console.log('Done!');
}

syncLogos();
