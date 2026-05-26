import * as cheerio from 'cheerio';

/**
 * Scrape article content from a web page when RSS content is insufficient.
 * Used as a fallback when RSS feeds don't provide full article text.
 */
export async function scrapeArticle(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, nav, footer, header, aside, .ad, .advertisement, .social-share, .comments, .related-posts, [role="complementary"]').remove();

    // Try common article content selectors
    const contentSelectors = [
      'article .entry-content',
      'article .post-content',
      'article .article-body',
      '.article-content',
      '.post-body',
      '.entry-content',
      'article',
      '[itemprop="articleBody"]',
      '.story-body',
      'main'
    ];

    let content = '';
    for (const selector of contentSelectors) {
      const el = $(selector);
      if (el.length && el.text().trim().length > 200) {
        content = el.text().trim();
        break;
      }
    }

    // Extract hero image
    let imageUrl = null;
    const ogImage = $('meta[property="og:image"]').attr('content');
    const twitterImage = $('meta[name="twitter:image"]').attr('content');
    imageUrl = ogImage || twitterImage || null;

    return {
      content: content.substring(0, 5000), // Cap for AI input
      image_url: imageUrl
    };
  } catch (error) {
    console.error(`[Scraper] Error scraping ${url}:`, error.message);
    return { content: '', image_url: null };
  }
}
