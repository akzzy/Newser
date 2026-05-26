/**
 * One-time cleanup script to remove existing duplicate articles from the database.
 * Run once: node src/cleanup_duplicates.js
 *
 * Strategy: Group articles by semantic similarity within the last 7 days.
 * For each group of duplicates, keep the one published earliest and delete the rest.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calculateTitleSimilarity } from './services/deduplicator.js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function cleanup() {
  console.log('Fetching recent articles...');
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, published_at, sources ( name )')
    .gte('published_at', cutoff)
    .order('published_at', { ascending: true }); // Earliest first

  if (error) {
    console.error('Error fetching articles:', error.message);
    return;
  }

  console.log(`Found ${articles.length} recent articles. Scanning for duplicates...\n`);

  const kept = [];        // Titles we're keeping
  const toDelete = [];    // IDs to delete

  for (const article of articles) {
    let isDuplicate = false;
    let matchedTitle = '';

    for (const keptTitle of kept) {
      const score = calculateTitleSimilarity(article.title, keptTitle);
      if (score >= 0.30) {
        isDuplicate = true;
        matchedTitle = keptTitle;
        break;
      }
    }

    if (isDuplicate) {
      toDelete.push(article.id);
      console.log(`🗑️  DELETE: [${article.sources?.name}] "${article.title}"`);
      console.log(`   Matches: "${matchedTitle}"`);
    } else {
      kept.push(article.title);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Keeping: ${kept.length} unique articles`);
  console.log(`Deleting: ${toDelete.length} duplicates`);

  if (toDelete.length === 0) {
    console.log('\nNo duplicates found. Database is clean!');
    return;
  }

  console.log('\nDeleting duplicates from database...');
  for (const id of toDelete) {
    const { error: delErr } = await supabase
      .from('articles')
      .delete()
      .eq('id', id);

    if (delErr) {
      console.error(`  Error deleting ${id}: ${delErr.message}`);
    }
  }

  console.log('Done! Duplicate articles removed.');
}

cleanup();
