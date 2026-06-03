let API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Dynamically adjust API base on the client side to match the host IP (for mobile preview)
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.startsWith('127.')) {
    API_BASE = `http://${hostname}:3001`;
  }
}

export interface Source {
  name: string;
  slug: string;
  logo_url: string;
  color: string;
}

export interface Article {
  id: string;
  title_hook: string;
  deep_dive_content: string;
  read_time: string;
  image_url: string | null;
  ai_category: string;
  ai_tags: string[];
  published_at: string;
  original_url: string;
  source: Source | null;
}

export interface ArticlesResponse {
  articles: Article[];
  user_interests?: string[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}

/**
 * Fetch paginated articles feed.
 */
export async function fetchArticles(
  page = 1,
  limit = 20,
  category = 'all',
  source = 'all',
  sort = 'foryou',
  guest_id: string | null = null,
  blockedCategories: string[] = [],
  blockedSources: string[] = [],
  boostedCategories: string[] = [],
  boostedSources: string[] = []
): Promise<ArticlesResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(category !== 'all' && { category }),
    ...(source !== 'all' && { source }),
    ...(sort && { sort }),
    ...(guest_id && { guest_id })
  });

  if (blockedCategories.length > 0) {
    params.append('blocked_categories', blockedCategories.join(','));
  }
  if (blockedSources.length > 0) {
    params.append('blocked_sources', blockedSources.join(','));
  }
  if (boostedCategories.length > 0) {
    params.append('boosted_categories', boostedCategories.join(','));
  }
  if (boostedSources.length > 0) {
    params.append('boosted_sources', boostedSources.join(','));
  }

  let retries = 2;
  while (retries > 0) {
    try {
      const res = await fetch(`${API_BASE}/api/articles?${params}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (!res.ok) throw new Error('Failed to fetch articles');
      return await res.json();
    } catch (err) {
      retries--;
      if (retries === 0) throw err;
      // Wait 500ms before retrying to allow backend to wake up
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  throw new Error('Failed to fetch articles after retries');
}

/**
 * Fetch a single article by ID
 */
export async function fetchArticleById(id: string): Promise<Article | null> {
  const res = await fetch(`${API_BASE}/api/articles/${id}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' }
  });
  
  if (!res.ok) {
    return null;
  }
  
  return res.json();
}

/**
 * Fetch all available categories from current articles.
 */
export async function fetchCategories(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/sources/categories`, {
    next: { revalidate: 3600 }
  });
  
  if (!res.ok) return ['all'];
  const data = await res.json();
  return ['all', ...data.categories];
}

/**
 * Record an implicit user interaction (read or share)
 */
export async function trackInteraction(
  guest_id: string,
  category: string,
  action: 'view' | 'read' | 'share' | 'like'
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/interactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ guest_id, category, action }),
    });
  } catch (error) {
    console.error('Failed to track interaction:', error);
  }
}

export interface Source {
  id: string;
  name: string;
  slug: string;
  feed_url: string;
  website_url: string;
  logo_url: string;
  color: string;
  category: string;
}

/**
 * Fetch all active news sources (Channels)
 */
export async function fetchSources(): Promise<Source[]> {
  const res = await fetch(`${API_BASE}/api/sources`, {
    next: { revalidate: 0 } // Force refresh to load new logos
  });
  
  if (!res.ok) return [];
  const data = await res.json();
  return data.sources || [];
}
