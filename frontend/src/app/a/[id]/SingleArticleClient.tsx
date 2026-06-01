'use client';

import { useEffect, useRef } from 'react';
import { useArticleStore } from '@/store/useArticleStore';
import { Article, fetchArticles } from '@/lib/api';

export default function SingleArticleClient({ article }: { article: Article }) {
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      
      // 1. Inject the shared article as the very first card in the feed
      useArticleStore.getState().setArticles([article], true);
      useArticleStore.getState().setCurrentIndex(0);
      
      // Setup contextual feed for continuous scrolling
      const contextCategory = article.ai_category || 'general';
      useArticleStore.getState().setSharedLinkMode(contextCategory);
      useArticleStore.getState().setCategory(contextCategory);
      useArticleStore.getState().setSort('latest');
      
      // 2. Background-fetch the rest of the news in the SAME category
      fetchArticles(1, 20, contextCategory, 'all', 'latest').then(data => {
        // Filter out the shared article so it doesn't appear twice if it's recent
        const newArticles = data.articles.filter(a => a.id !== article.id);
        useArticleStore.getState().appendArticles(newArticles, data.pagination.has_more);
      });
      
      // 3. Quietly rewrite the URL back to root
      window.history.replaceState(null, '', '/');
    }
  }, [article]);

  return null;
}
