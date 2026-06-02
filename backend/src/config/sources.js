/**
 * News source configurations for Newser.
 * Each source defines how to fetch and categorize articles.
 */
export const sources = [
  {
    name: 'The Verge',
    slug: 'the-verge',
    feed_url: 'https://www.theverge.com/rss/index.xml',
    website_url: 'https://www.theverge.com',
    logo_url: '/logos/the-verge.jpeg',
    color: '#E40256',
    category: 'general',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'Android Authority',
    slug: 'android-authority',
    feed_url: 'https://www.androidauthority.com/feed/',
    website_url: 'https://www.androidauthority.com',
    logo_url: '/logos/android-authority.jpeg',
    color: '#00C853',
    category: 'mobile',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'TechCrunch',
    slug: 'techcrunch',
    feed_url: 'https://techcrunch.com/feed/',
    website_url: 'https://techcrunch.com',
    logo_url: '/logos/techcrunch.png',
    color: '#0A9E01',
    category: 'startups',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'Ars Technica',
    slug: 'ars-technica',
    feed_url: 'https://feeds.arstechnica.com/arstechnica/index',
    website_url: 'https://arstechnica.com',
    logo_url: '/logos/ars-technica.png',
    color: '#FF4400',
    category: 'general',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'Wired',
    slug: 'wired',
    feed_url: 'https://www.wired.com/feed/rss',
    website_url: 'https://www.wired.com',
    logo_url: '/logos/wired.jpeg',
    color: '#000000',
    category: 'general',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: '9to5Google',
    slug: '9to5google',
    feed_url: 'https://9to5google.com/feed/',
    website_url: 'https://9to5google.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://9to5google.com&size=128',
    color: '#1A73E8',
    category: 'mobile',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'The Next Web',
    slug: 'the-next-web',
    feed_url: 'https://thenextweb.com/feed',
    website_url: 'https://thenextweb.com',
    logo_url: '/logos/the-next-web.png',
    color: '#E10000',
    category: 'general',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'Engadget',
    slug: 'engadget',
    feed_url: 'https://www.engadget.com/rss.xml',
    website_url: 'https://www.engadget.com',
    logo_url: '/logos/engadget.jpeg',
    color: '#000000',
    category: 'general',
    fetch_method: 'rss',
  },
  // --- New Categories (Gaming, Entertainment, Sports, World News) ---
  {
    name: 'IGN',
    slug: 'ign',
    feed_url: 'https://feeds.ign.com/ign/news',
    website_url: 'https://www.ign.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://ign.com&size=128',
    color: '#BF1313',
    category: 'gaming',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'Variety',
    slug: 'variety',
    feed_url: 'https://variety.com/feed/',
    website_url: 'https://variety.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://variety.com&size=128',
    color: '#000000',
    category: 'entertainment',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'CBS Sports',
    slug: 'cbs-sports',
    feed_url: 'https://www.cbssports.com/rss/headlines/',
    website_url: 'https://www.cbssports.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://cbssports.com&size=128',
    color: '#000066',
    category: 'sports',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'Autosport F1',
    slug: 'autosport',
    feed_url: 'https://www.autosport.com/rss/f1/news/',
    website_url: 'https://www.autosport.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://autosport.com&size=128',
    color: '#E31837',
    category: 'sports',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'Al Jazeera',
    slug: 'al-jazeera',
    feed_url: 'https://www.aljazeera.com/xml/rss/all.xml',
    website_url: 'https://www.aljazeera.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://aljazeera.com&size=128',
    color: '#F9A01B',
    category: 'world',
    fetch_method: 'rss',
  },
  {
    name: 'BBC News',
    slug: 'bbc-news',
    feed_url: 'http://feeds.bbci.co.uk/news/world/rss.xml',
    website_url: 'https://www.bbc.com/news/world',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://bbc.com&size=128',
    color: '#B80000',
    category: 'world',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'NPR',
    slug: 'npr',
    feed_url: 'https://feeds.npr.org/1004/rss.xml',
    website_url: 'https://www.npr.org/sections/world/',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://npr.org&size=128',
    color: '#222222',
    category: 'world',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'Jalopnik',
    slug: 'jalopnik',
    feed_url: 'https://jalopnik.com/rss',
    website_url: 'https://jalopnik.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://jalopnik.com&size=128',
    color: '#222222',
    category: 'automotive',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'Car and Driver',
    slug: 'car-and-driver',
    feed_url: 'https://www.caranddriver.com/rss/all.xml/',
    website_url: 'https://www.caranddriver.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://caranddriver.com&size=128',
    color: '#1D1D1D',
    category: 'automotive',
    fetch_method: 'rss',
    is_active: true
  }
];
