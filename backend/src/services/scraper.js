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
    const sourceName = sourceConfig?.name;
    
    // Check if this source MUST be scraped via Render
    if (RENDER_SOURCES.includes(sourceName)) {
      console.log(`[Scraper] ${sourceName} requires Render microservice. Routing there directly...`);
      return await scrapeWithRender(url, sourceConfig);
    }

    // Default fast route: use lightweight local extractor with spoofed browser headers
    console.log(`[Scraper] Using fast local extractor for ${url}...`);
    
    // Some sites (like CBS Sports) reject default Node.js fetch headers with 406 Not Acceptable.
    // By manually fetching with browser-like headers, we bypass basic server firewalls.
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    const html = await response.text();
    const extracted = await extract(html, url); // Pass HTML and original URL
    
    if (extracted && extracted.content) {
      let htmlContent = extracted.content;
      
      // If an <article> tag exists, only keep the HTML from that point forward.
      // This brilliantly skips affiliate disclaimers, author bios, and read times that appear before the actual article text!
      const articleMatch = htmlContent.match(/<article[^>]*>/i);
      if (articleMatch) {
         htmlContent = htmlContent.substring(articleMatch.index);
      }

      // Strip HTML to get clean plain text before capping length
      let content = stripHtml(htmlContent);
      // Cap at 15000 chars for AI context limits (ensures full article)
      content = content.substring(0, 15000);
      let imageUrl = extracted.image || null;
      
      // Clean up image URLs (e.g. remove ?w=150 from TechCrunch images to get full quality)
      if (imageUrl) {
        try {
          const urlObj = new URL(imageUrl);
          
          // WARNING: If the URL contains a cryptographic signature (like The Guardian's &s= or AWS &Expires=),
          // altering any part of the query string will invalidate the signature and result in a 401/403 error!
          const hasSignature = ['s', 'sig', 'signature', 'token', 'hmac', 'Expires', 'ExpiresIn'].some(key => urlObj.searchParams.has(key));
          
          if (!hasSignature) {
            const paramsToRemove = ['w', 'h', 'resize', 'fit', 'crop', 'width', 'height', 'q', 'quality', 'auto', 'format'];
            paramsToRemove.forEach(p => urlObj.searchParams.delete(p));
            imageUrl = urlObj.toString();
          }
        } catch(e) {
          // If URL parsing fails, just leave it as is
        }
      }

      return {
        content: content,
        image_url: imageUrl
      };
    } else {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      console.log(`[Scraper] Fast extractor returned null for ${url}. Falling back to Render...`);
      return await scrapeWithRender(url, sourceConfig);
    }

  } catch (error) {
    console.log(`[Scraper] Fast extractor failed for ${url}: ${error.message}. Falling back to Render...`);
    return await scrapeWithRender(url, sourceConfig);
  }
}

/**
 * Calls the heavy Puppeteer microservice on Render.
 */
async function scrapeWithRender(url, sourceConfig) {
  try {
    const serviceUrl = process.env.SCRAPER_SERVICE_URL || 'http://localhost:4000';
    
    const body = { url };
    if (sourceConfig && sourceConfig.content_selector) {
      body.selector = sourceConfig.content_selector;
    }

    const response = await fetch(`${serviceUrl}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // Wait up to 2 minutes for the microservice
      signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Microservice HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    let content = data.content;
    if (content) {
      content = content.substring(0, 15000);
    }

    return {
      content: content || '',
      image_url: data.image_url || null 
    };
  } catch (error) {
    console.error(`[Scraper] Error delegating ${url} to microservice:`, error.message);
    throw error;
  }
}

/**
 * Ping the scraper service to keep it awake on free tiers (e.g. Render).
 */
export async function pingScraper() {
  try {
    const serviceUrl = process.env.SCRAPER_SERVICE_URL || 'http://localhost:4000';
    // Just a quick fire-and-forget fetch to the health endpoint with a short timeout
    await fetch(`${serviceUrl}/health`, { signal: AbortSignal.timeout(5000) });
  } catch (err) {
    // Ignore errors, we just want to wake it up
  }
}
