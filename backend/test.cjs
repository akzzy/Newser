const RssParser = require('rss-parser');
const parser = new RssParser();
parser.parseURL('https://www.theguardian.com/uk/rss').then(feed => {
  const item = feed.items.find(i => i.title.includes('aviation') || i.link.includes('aviation'));
  if (item) {
    const html = item['content:encoded'] || item.content;
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    console.log('Regex extracted URL:', imgMatch ? imgMatch[1] : 'No match');
  } else {
    console.log('Article not found in feed');
  }
});
