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
  guest_id: string | null = null
): Promise<ArticlesResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(category !== 'all' && { category }),
    ...(guest_id && { guest_id })
  });

  const res = await fetch(`${API_BASE}/api/articles?${params}`, {
    next: { revalidate: 60 }
  });

  if (!res.ok) throw new Error('Failed to fetch articles');
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
  action: 'read' | 'share'
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
