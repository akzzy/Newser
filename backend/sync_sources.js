import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { sources } from './src/config/sources.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
  for (const s of sources) {
    await supabase.from('sources').upsert({
      name: s.name, slug: s.slug, feed_url: s.feed_url, website_url: s.website_url,
      logo_url: s.logo_url, color: s.color, category: s.category, is_active: s.is_active !== false
    }, { onConflict: 'slug' });
  }
  const slugs = sources.map(s => s.slug);
  await supabase.from('sources').update({ is_active: false }).not('slug', 'in', `(${slugs.join(',')})`);
  console.log('Sources synced to DB successfully');
}
run();
