import RssParser from 'rss-parser';

const parser = new RssParser();
async function run() {
  const feed = await parser.parseURL('https://www.androidauthority.com/feed/');
  console.log('Latest 3 items from RSS:');
  feed.items.slice(0, 3).forEach(item => {
    console.log(`- ${item.title} (Published: ${item.pubDate})`);
  });
}
run();
