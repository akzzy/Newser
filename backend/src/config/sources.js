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
    logo_url: 'https://cdn.vox-cdn.com/uploads/chorus_asset/file/7395367/favicon-64x64.0.png',
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
    logo_url: 'https://www.androidauthority.com/wp-content/uploads/2016/10/cropped-aa-logo-mark-32x32.png',
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
    logo_url: 'https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png',
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
    logo_url: 'https://cdn.arstechnica.net/favicon.ico',
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
    logo_url: 'https://www.wired.com/verso/static/wired/assets/favicon.ico',
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
    logo_url: 'https://9to5google.com/wp-content/uploads/sites/4/2021/07/cropped-9to5google-icon-32x32.png',
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
    logo_url: 'https://next.tnwcdn.com/assets/img/favicon/favicon-32x32.png',
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
    logo_url: 'https://s.blogsmithmedia.com/www.engadget.com/assets-haa26965e9e6/images/favicon-32x32.png',
    color: '#000000',
    category: 'general',
    fetch_method: 'rss',
    is_active: true
  }
];
