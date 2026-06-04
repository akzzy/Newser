import fetch from 'node-fetch';

/**
 * Scrape article content from a web page when RSS content is insufficient.
 * Now routes through our stealth Puppeteer microservice on Render.
 */
export async function scrapeArticle(url, sourceConfig = null) {
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
      // Wait up to 45s for the microservice to launch Chrome and scrape
      signal: AbortSignal.timeout(45000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Microservice HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // We get markdown straight from the microservice!
    let content = data.content;
    
    if (content) {
      // Cap at 5000 chars for AI context limits
      content = content.substring(0, 5000);
    }

    return {
      content: content || '',
      image_url: data.image_url || null 
    };
  } catch (error) {
    console.error(`[Scraper] Error delegating ${url} to microservice:`, error.message);
    return { content: '', image_url: null };
  }
}
