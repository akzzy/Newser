'use client';

import { useEffect, useRef } from 'react';
import { useArticleStore } from '@/store/useArticleStore';
import { Article, fetchArticles } from '@/lib/api';

export default function SingleArticleClient({ article }: { article: Article }) {
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      
      // 1. Setup contextual feed for continuous scrolling
      // (Call these FIRST because setCategory and setSort automatically wipe the articles array)
      const contextCategory = article.ai_category || 'general';
      useArticleStore.getState().setCategory(contextCategory);
      useArticleStore.getState().setSort('latest');
      useArticleStore.getState().setSharedLinkMode(contextCategory);
      
      // 2. Inject the shared article as the very first card in the feed
      useArticleStore.getState().setArticles([article], true);
      useArticleStore.getState().setCurrentIndex(0);
      
      // 2. Background-fetch the rest of the news in the SAME category
      fetchArticles(1, 20, contextCategory, 'all', 'latest').then(data => {
        // Filter out the shared article so it doesn't appear twice if it's recent
        const newArticles = data.articles.filter(a => a.id !== article.id);
        useArticleStore.getState().appendArticles(newArticles, data.pagination.has_more);
      });
    }
  }, [article]);

  return null;
}
