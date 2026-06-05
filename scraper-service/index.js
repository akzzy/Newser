import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

// Apply stealth plugin
puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Global browser instance to save massive CPU overhead on Render free tier
let globalBrowser = null;

async function getBrowser() {
  if (!globalBrowser || !globalBrowser.isConnected()) {
    console.log('[Scraper] Launching new global Chrome instance...');
    globalBrowser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
      ]
    });
  }
  return globalBrowser;
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/scrape', async (req, res) => {
  const { url: rawUrl, selector } = req.body;
  const url = rawUrl ? rawUrl.trim() : null;
  if (!url) {
    return res.status(400).json({ error: 'Missing URL' });
  }

  let page = null;
  try {
    const browser = await getBrowser();
    console.log(`[Scrape] Opening new page for: ${url}`);
    
    page = await browser.newPage();

    // Block unnecessary resources (images, fonts, css) to save memory and bandwidth
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Navigate to URL and wait for DOM content to load
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait a brief moment to allow dynamic JS to inject content if necessary
    await new Promise(r => setTimeout(r, 2000));

    // Get the full HTML
    const html = await page.content();
    const doc = new JSDOM(html, { url });
    
    let textContent = '';
    let articleTitle = '';
    let articleByline = '';
    
    // Extract hero image
    const ogImage = doc.window.document.querySelector('meta[property="og:image"]')?.getAttribute('content');
    const twitterImage = doc.window.document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
    const imageUrl = ogImage || twitterImage || null;

    if (selector) {
      // If a specific CSS selector is provided (e.g., for CarBuzz to avoid author bios)
      console.log(`[Scrape] Using custom selector: ${selector}`);
      
      const elements = doc.window.document.querySelectorAll(selector);
      if (elements.length > 0) {
        // Extract text from all matched elements
        textContent = Array.from(elements)
          .map(el => el.textContent.trim())
          .filter(text => text.length > 0)
          .join('\n\n');
      }
      
      // Fallback to basic title extraction if we don't use Readability
      articleTitle = doc.window.document.querySelector('title')?.textContent || '';
    } else {
      // Fallback to Mozilla Readability for generic scraping
      const reader = new Readability(doc.window.document);
      const article = reader.parse();

      if (article && article.textContent) {
        textContent = article.textContent
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join('\n\n');
        
        articleTitle = article.title;
        articleByline = article.byline;
      }
    }

    if (!textContent || textContent.trim().length < 200) {
      console.warn(`[Scrape] Failed to extract readable content for ${url}`);
      return res.status(422).json({ error: 'Could not extract sufficient content' });
    }

    console.log(`[Scrape] Successfully extracted ${textContent.length} chars from ${url}`);
    
    res.json({
      content: textContent,
      title: articleTitle,
      byline: articleByline,
      length: textContent.length,
      image_url: imageUrl
    });

  } catch (error) {
    console.error(`[Scrape] Error for ${url}:`, error.message);
    res.status(500).json({ error: error.message });
  } finally {
    if (page) {
      await page.close().catch(e => console.error('Error closing page:', e.message));
      console.log(`[Scrape] Page closed`);
    }
  }
});

app.listen(PORT, () => {
  console.log(`Scraper microservice running on port ${PORT}`);
});
