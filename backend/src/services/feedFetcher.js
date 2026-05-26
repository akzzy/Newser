import RssParser from 'rss-parser';

const parser = new RssParser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Newser/1.0 (RSS Aggregator)',
    'Accept': 'application/rss+xml, application/xml, text/xml'
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure']
    ]
  }
});

/**
 * Extract the best available image URL from an RSS item.
 */
function extractImageUrl(item) {
  // Try media:content first
  if (item.mediaContent && item.mediaContent.$) {
    return item.mediaContent.$.url;
  }

  // Try media:thumbnail
  if (item.mediaThumbnail && item.mediaThumbnail.$) {
    return item.mediaThumbnail.$.url;
  }

  // Try enclosure (common in podcasts/media feeds)
  if (item.enclosure && item.enclosure.url && item.enclosure.type?.startsWith('image')) {
    return item.enclosure.url;
  }

  // Try extracting from content HTML
  if (item['content:encoded'] || item.content) {
    const html = item['content:encoded'] || item.content;
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) return imgMatch[1];
  }

  return null;
}

/**
 * Strip HTML tags and decode entities for clean text content.
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch and parse RSS feed for a given source.
 * Returns normalized article objects.
 */
export async function fetchFeed(source, maxAgeHours = 24) {
  try {
    const feed = await parser.parseURL(source.feed_url);
    const articles = [];
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    for (const item of feed.items) {
      // Skip articles older than maxAgeHours
      const pubDate = new Date(item.isoDate || item.pubDate || 0);
      if (pubDate < cutoff) continue;

      // Extract the best text content available
      const rawContent = item['content:encoded'] || item.content || item.contentSnippet || item.summary || '';
      const cleanContent = stripHtml(rawContent);

      // Skip items without meaningful content
      if (!item.title || cleanContent.length < 50) continue;

      articles.push({
        title: item.title.trim(),
        original_content: cleanContent.substring(0, 5000), // Cap at 5000 chars for AI input
        url: item.link || item.guid,
        image_url: extractImageUrl(item),
        author: item.creator || item.author || item['dc:creator'] || null,
        published_at: item.isoDate || item.pubDate || new Date().toISOString(),
        source_slug: source.slug
      });
    }

    return articles;
  } catch (error) {
    console.error(`[FeedFetcher] Error fetching ${source.name}:`, error.message);
    return [];
  }
}
