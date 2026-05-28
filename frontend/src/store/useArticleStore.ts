'use client';

import { create } from 'zustand';
import type { Article } from '@/lib/api';

interface ArticleStore {
  articles: Article[];
  currentIndex: number;
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  category: string;
  drawerArticle: Article | null;
  isDrawerOpen: boolean;
  guestId: string | null;

  initializeGuestId: () => void;
  setArticles: (articles: Article[], hasMore: boolean) => void;
  appendArticles: (articles: Article[], hasMore: boolean) => void;
  setCurrentIndex: (index: number) => void;
  setPage: (page: number) => void;
  setLoading: (loading: boolean) => void;
  setCategory: (category: string) => void;
  openDrawer: (article: Article) => void;
  closeDrawer: () => void;
}

export const useArticleStore = create<ArticleStore>((set) => ({
  articles: [],
  currentIndex: 0,
  page: 1,
  hasMore: true,
  isLoading: false,
  category: 'all',
  drawerArticle: null,
  isDrawerOpen: false,
  guestId: null,

  initializeGuestId: () => {
    if (typeof window === 'undefined') return;
    
    let id = localStorage.getItem('newser_guest_id');
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `guest_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('newser_guest_id', id);
    }
    set({ guestId: id });
  },

  setArticles: (articles, hasMore) =>
    set({ articles, hasMore, page: 1 }),

  appendArticles: (newArticles, hasMore) =>
    set((state) => ({
      articles: [...state.articles, ...newArticles],
      hasMore
    })),

  setCurrentIndex: (index) => set({ currentIndex: index }),
  setPage: (page) => set({ page }),
  setLoading: (loading) => set({ isLoading: loading }),
  setCategory: (category) => set({ category, articles: [], page: 1, currentIndex: 0 }),
  openDrawer: (article) => set({ drawerArticle: article, isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false })
}));
