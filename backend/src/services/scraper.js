import { extract } from '@extractus/article-extractor';

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

    // Default fast route: use lightweight local extractor
    console.log(`[Scraper] Using fast local extractor for ${url}...`);
    const extracted = await extract(url);
    
    if (extracted && extracted.content) {
      let content = extracted.content;
      // Cap at 5000 chars for AI context limits
      content = content.substring(0, 5000);
      let imageUrl = extracted.image || null;
      
      // Clean up image URLs (e.g. remove ?w=150 from TechCrunch images to get full quality)
      if (imageUrl) {
        // Strip out resizing query parameters like ?w=150 or ?resize=...
        // By removing everything after the '?' for known image extensions, we get the original high-res image.
        if (imageUrl.includes('?')) {
           imageUrl = imageUrl.split('?')[0];
        }
      }

      return {
        content: content,
        image_url: imageUrl
      };
    } else {
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
      content = content.substring(0, 5000);
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
