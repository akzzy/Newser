'use client';

import { useEffect, useRef } from 'react';
import { useArticleStore } from '@/store/useArticleStore';
import { Article, fetchArticles } from '@/lib/api';

export default function SingleArticleClient({ article }: { article: Article }) {
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      
      const store = useArticleStore.getState();
      const contextCategory = article.ai_category || 'general';
      
      // 1. Mark shared link mode so Feed.tsx knows not to auto-load
      store.setSharedLinkMode(contextCategory);
      
      // 2. Inject the shared article as the very first card
      //    (use setArticles directly — do NOT call setCategory/setSort because
      //    they have destructive side effects that wipe the articles array)
      store.setArticles([article], true);
      store.setCurrentIndex(0);
      
      // 3. Background-fetch continuation articles
      //    - For NEW users (no guest_id or no preferences): fetch same category as shared article
      //    - For EXISTING users: fetch their personalized 'foryou' feed
      const guestId = store.guestId;
      const hasOnboarded = store.hasCompletedOnboarding;
      
      if (hasOnboarded && guestId) {
        // Existing user: load their personalized feed (the backend handles preference lookup)
        fetchArticles(1, 20, 'all', 'all', 'foryou', guestId).then(data => {
          const newArticles = data.articles.filter(a => a.id !== article.id);
          store.appendArticles(newArticles, data.pagination.has_more);
        });
      } else {
        // New user: show more articles from the same category as the shared article
        fetchArticles(1, 20, contextCategory, 'all', 'latest').then(data => {
          const newArticles = data.articles.filter(a => a.id !== article.id);
          store.appendArticles(newArticles, data.pagination.has_more);
        });
      }
    }
  }, [article]);

  return null;
}
