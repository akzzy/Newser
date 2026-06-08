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
    if (imgMatch) {
      const imgUrl = imgMatch[1];
      // Reject generic Google News logos and icons
      if (!imgUrl.includes('news.google.com') && !imgUrl.includes('gstatic.com') && !imgUrl.includes('news.google.co')) {
        return imgUrl;
      }
    }
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
    const feedUrls = source.feed_url.split(',').map(u => u.trim()).filter(Boolean);
    const articles = [];
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    for (const url of feedUrls) {
      try {
        const feed = await parser.parseURL(url);
        
        for (const item of feed.items) {
          // Skip articles older than maxAgeHours
          const pubDate = new Date(item.isoDate || item.pubDate || 0);
          if (pubDate < cutoff) continue;

      // Extract the best text content available
      const rawContent = item['content:encoded'] || item.content || item.contentSnippet || item.summary || '';
      const cleanContent = stripHtml(rawContent);

      // Skip items without a title
      if (!item.title) continue;

      const titleLower = item.title.toLowerCase();

      // Skip promotional articles from Wired
      if (source.slug === 'wired') {
        const isPromo = /(promo code|promocode|coupon|discount code)/.test(titleLower);
        const hasMonth = /(january|february|march|april|may|june|july|august|september|october|november|december)/.test(titleLower);

        // If it contains promo/coupon keywords AND a month name, it's definitely a monthly coupon post
        if (isPromo && hasMonth) {
          console.log(`[FeedFetcher] Skipping promotional Wired article (Title Match): "${item.title}"`);
          continue;
        }

        // Also aggressively filter based on the URL containing promo/coupon keywords
        const urlLower = (item.link || item.guid || '').toLowerCase();
        if (/(promo|coupon)/.test(urlLower)) {
          console.log(`[FeedFetcher] Skipping promotional Wired article (URL Match): "${urlLower}"`);
          continue;
        }
      }

      let cleanTitle = item.title.trim();
      
      // Strip source name from the end of the title (e.g. " - AP News" or " | TechCrunch")
      // This prevents the deduplicator from getting falsely triggered by shared branding tokens
      const escapedSourceName = source.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const suffixRegex = new RegExp(`\\s+[-|]\\s+${escapedSourceName}$`, 'i');
          cleanTitle = cleanTitle.replace(suffixRegex, '');
          
          const originalUrl = (item.link || item.guid || '').trim();
          
          // Skip duplicates
          if (articles.some(a => a.url === originalUrl)) continue;

          articles.push({
            title: cleanTitle,
            original_content: cleanContent.substring(0, 15000), // Cap at 15000 chars for AI input
            url: originalUrl,
            image_url: extractImageUrl(item),
            author: item.creator || item.author || item['dc:creator'] || null,
            published_at: item.isoDate || item.pubDate || new Date().toISOString(),
            source_slug: source.slug
          });
        }
      } catch (error) {
        console.error(`[FeedFetcher] Error fetching sub-feed ${url} for source ${source.name}: ${error.message}`);
      }
    }

    // Sort by most recent first and cap at 15 to prevent high-volume feeds from flooding the app
    articles.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    return articles.slice(0, 15);
  } catch (error) {
    console.error(`[FeedFetcher] Error fetching ${source.name}:`, error.message);
    return [];
  }
}
