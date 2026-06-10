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
    name: 'Android Central',
    slug: 'android-central',
    feed_url: 'https://www.androidcentral.com/feed',
    website_url: 'https://www.androidcentral.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://androidcentral.com&size=128',
    color: '#A4C639',
    category: 'mobile',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'Autoblog',
    slug: 'autoblog',
    feed_url: 'https://www.autoblog.com/.rss/feed/3d70fbb5-ef5e-44f3-a547-e60939496e82.xml',
    website_url: 'https://www.autoblog.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://autoblog.com&size=128',
    color: '#005599',
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
  },
  {
    name: 'CarBuzz',
    slug: 'carbuzz',
    feed_url: 'https://carbuzz.com/feed/category/news/',
    website_url: 'https://carbuzz.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://carbuzz.com&size=128',
    color: '#FF6600',
    category: 'automotive',
    fetch_method: 'rss',
    content_selector: '#article-body > div.content-block-regular > p',
    is_active: true
  },
  {
    name: 'TheDrive',
    slug: 'the-drive',
    feed_url: 'https://www.thedrive.com/feed',
    website_url: 'https://www.thedrive.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://thedrive.com&size=128',
    color: '#282828',
    category: 'automotive',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'The Race',
    slug: 'the-race',
    feed_url: 'https://www.the-race.com/rss/',
    website_url: 'https://www.the-race.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://the-race.com&size=128',
    color: '#E81C24',
    category: 'sports',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'Screen Rant',
    slug: 'screen-rant',
    feed_url: 'https://screenrant.com/feed/',
    website_url: 'https://screenrant.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://screenrant.com&size=128',
    color: '#FF0000',
    category: 'entertainment',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: '9to5Mac',
    slug: '9to5mac',
    feed_url: 'https://9to5mac.com/feed/',
    website_url: 'https://9to5mac.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://9to5mac.com&size=128',
    color: '#E2E2E2',
    category: 'mobile',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'Space Daily',
    slug: 'space-daily',
    feed_url: 'https://spacedaily.com/feed/',
    website_url: 'https://spacedaily.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://spacedaily.com&size=128',
    color: '#003366',
    category: 'science',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'BGR',
    slug: 'bgr',
    feed_url: 'https://www.bgr.com/feed/',
    website_url: 'https://www.bgr.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://bgr.com&size=128',
    color: '#D8232A',
    category: 'mobile',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'Motorsport',
    slug: 'motorsport',
    feed_url: 'https://www.motorsport.com/rss/f1/news/,https://www.motorsport.com/rss/motogp/news/,https://www.motorsport.com/rss/wec/news/,https://www.motorsport.com/rss/imsa/news/',
    website_url: 'https://www.motorsport.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://motorsport.com&size=128',
    color: '#FF0000',
    category: 'sports',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'AI News',
    slug: 'ai-news',
    feed_url: 'https://www.artificialintelligence-news.com/feed/',
    website_url: 'https://www.artificialintelligence-news.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://artificialintelligence-news.com&size=128',
    color: '#00C853',
    category: 'ai',
    fetch_method: 'rss',
    is_active: false
  },
  {
    name: 'SciTechDaily',
    slug: 'scitechdaily',
    feed_url: 'https://scitechdaily.com/feed/',
    website_url: 'https://scitechdaily.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://scitechdaily.com&size=128',
    color: '#2E8B57',
    category: 'science',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'PC Gamer',
    slug: 'pc-gamer',
    feed_url: 'https://www.pcgamer.com/feeds.xml,https://www.pcgamer.com/feeds/tag/hardware/',
    website_url: 'https://www.pcgamer.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://pcgamer.com&size=128',
    color: '#D42127',
    category: 'gaming',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'Tom\'s Hardware',
    slug: 'toms-hardware',
    feed_url: 'https://www.tomshardware.com/feeds.xml',
    website_url: 'https://www.tomshardware.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://tomshardware.com&size=128',
    color: '#CC0000',
    category: 'hardware',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'The Hollywood Reporter',
    slug: 'hollywood-reporter',
    feed_url: 'https://www.hollywoodreporter.com/feed/rss/',
    website_url: 'https://www.hollywoodreporter.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://hollywoodreporter.com&size=128',
    color: '#000000',
    category: 'entertainment',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'Collider',
    slug: 'collider',
    feed_url: 'https://collider.com/feed/',
    website_url: 'https://collider.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://collider.com&size=128',
    color: '#F4511E',
    category: 'entertainment',
    fetch_method: 'rss',
    is_active: true
  },
  {
    name: 'MacRumors',
    slug: 'macrumors',
    feed_url: 'https://feeds.macrumors.com/MacRumors-All',
    website_url: 'https://www.macrumors.com',
    logo_url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://macrumors.com&size=128',
    color: '#212121',
    category: 'mobile',
    fetch_method: 'rss',
    is_active: true
  }
];
