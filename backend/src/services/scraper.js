import { extract } from '@extractus/article-extractor';

// Helper to strip HTML tags so we send clean text to the AI (just like our old markdown scraper did)
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// List of source names that strictly require the Render microservice to bypass Cloudflare
const RENDER_SOURCES = [];

/**
 * Scrape article content from a web page when RSS content is insufficient.
 * Uses lightweight extractus by default, falls back to Render microservice for stubborn sites.
 */
export async function scrapeArticle(url, sourceConfig = null) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      signal: AbortSignal.timeout(10000)
    });

    // Bail early if the page returned an error or non-HTML response
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('html')) {
      throw new Error(`Non-HTML response: ${contentType}`);
    }

    const html = await response.text();

    // Isolate Readability/DOM errors so they produce a clean fallback
    let extracted;
    try {
      extracted = await extract(html, url);
    } catch (parseErr) {
      throw new Error(`Parser failed: ${parseErr.message}`);
    }

    if (!extracted || !extracted.content) {
      throw new Error('No content extracted');
    }

    let htmlContent = extracted.content;
    const articleMatch = htmlContent.match(/<article[^>]*>/i);
    if (articleMatch) {
      htmlContent = htmlContent.substring(articleMatch.index);
    }

    let content = stripHtml(htmlContent).substring(0, 15000);
    let imageUrl = extracted.image || null;

    if (imageUrl) {
      try {
        const urlObj = new URL(imageUrl);
        const hasSignature = ['s', 'sig', 'signature', 'token', 'hmac', 'Expires', 'ExpiresIn'].some(key => urlObj.searchParams.has(key));
        if (!hasSignature) {
          ['w', 'h', 'resize', 'fit', 'crop', 'width', 'height', 'q', 'quality', 'auto', 'format'].forEach(p => urlObj.searchParams.delete(p));
          imageUrl = urlObj.toString();
        }
      } catch(e) {}
    }

    return { content, image_url: imageUrl };

  } catch (error) {
    throw error;
  }
}

/**
 * Ping the scraper service (no-op — Render removed, kept for interface compatibility).
 */
export async function pingScraper() {
  // No-op: Render microservice removed. Using local extractus only.
}
