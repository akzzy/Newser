import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const { data, error } = await supabase
  .from('articles')
  .select('title, original_content, source_id, sources!inner(name)')
  .not('original_content', 'is', null)
  .limit(100);

if (error) { console.error(error); process.exit(1); }

// Group by source and calculate word counts
const bySource = {};
for (const a of data) {
  const src = a.sources?.name || 'Unknown';
  if (!bySource[src]) bySource[src] = [];
  const words = (a.original_content || '').split(/\s+/).length;
  const paragraphs = (a.original_content || '').split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  const avgParaWords = paragraphs > 0 ? Math.round(words / paragraphs) : 0;
  bySource[src].push({ words, paragraphs, avgParaWords, title: a.title?.substring(0, 55) });
}

// Print analysis
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║          ARTICLE SIZE ANALYSIS BY SOURCE                    ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

for (const [src, articles] of Object.entries(bySource).sort((a,b) => b[1].length - a[1].length)) {
  const wordCounts = articles.map(a => a.words);
  const parasCounts = articles.map(a => a.paragraphs);
  const avg = Math.round(wordCounts.reduce((a,b) => a+b, 0) / wordCounts.length);
  const min = Math.min(...wordCounts);
  const max = Math.max(...wordCounts);
  const avgParas = Math.round(parasCounts.reduce((a,b) => a+b, 0) / parasCounts.length);
  const avgParaSize = avgParas > 0 ? Math.round(avg / avgParas) : 0;
  
  console.log(`=== ${src} (${articles.length} articles) ===`);
  console.log(`  Words:      avg=${avg}, min=${min}, max=${max}`);
  console.log(`  Paragraphs: avg=${avgParas}, avg words/para=${avgParaSize}`);
  
  // Show what compression would do
  const wouldCompress = articles.filter(a => a.words > 500).length;
  const wouldKeep = articles.length - wouldCompress;
  console.log(`  Compression: ${wouldKeep} kept as-is, ${wouldCompress} would be compressed`);
  
  // Show 2 sample articles
  articles.slice(0, 2).forEach(a => {
    console.log(`    -> ${a.words}w / ${a.paragraphs}p (${a.avgParaWords}w/p) - "${a.title}"`);
  });
  console.log('');
}

// Overall stats
const all = Object.values(bySource).flat();
const allWords = all.map(a => a.words);
const totalAvg = Math.round(allWords.reduce((a,b) => a+b, 0) / allWords.length);
const under500 = all.filter(a => a.words <= 500).length;
const under800 = all.filter(a => a.words <= 800).length;
const over800 = all.filter(a => a.words > 800).length;
const over1500 = all.filter(a => a.words > 1500).length;

console.log('=== OVERALL SUMMARY ===');
console.log(`Total articles analyzed: ${all.length}`);
console.log(`Average word count: ${totalAvg}`);
console.log(`  <= 500 words: ${under500} (${Math.round(under500/all.length*100)}%)`);
console.log(`  501-800 words: ${under800 - under500} (${Math.round((under800-under500)/all.length*100)}%)`);
console.log(`  801-1500 words: ${over800 - over1500} (${Math.round((over800-over1500)/all.length*100)}%)`);
console.log(`  > 1500 words: ${over1500} (${Math.round(over1500/all.length*100)}%)`);
