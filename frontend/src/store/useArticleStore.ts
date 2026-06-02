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
  source: string;
  sort: string;
  drawerArticle: Article | null;
  isDrawerOpen: boolean;
  guestId: string | null;
  hasCompletedOnboarding: boolean;
  showOnboardingPopup: boolean;
  sharedLinkMode: string | null;

  initializeGuestId: () => void;
  setArticles: (articles: Article[], hasMore: boolean) => void;
  appendArticles: (articles: Article[], hasMore: boolean) => void;
  setCurrentIndex: (index: number) => void;
  setPage: (page: number) => void;
  setLoading: (loading: boolean) => void;
  setCategory: (category: string) => void;
  setSource: (source: string) => void;
  setSort: (sort: string) => void;
  openDrawer: (article: Article) => void;
  closeDrawer: () => void;
  setSharedLinkMode: (category: string | null) => void;
  setShowOnboardingPopup: (show: boolean) => void;
  completeOnboarding: (categories: string[]) => Promise<void>;
  
  // Interactions
  likedArticles: Record<string, boolean>;
  toggleLike: (id: string) => void;
}
export const useArticleStore = create<ArticleStore>((set, get) => ({
  articles: [],
  currentIndex: 0,
  page: 1,
  hasMore: true,
  isLoading: false,
  category: 'all',
  source: 'all',
  sort: 'foryou',
  drawerArticle: null,
  isDrawerOpen: false,
  guestId: null,
  hasCompletedOnboarding: true, // Defaults to true to prevent flash, initializeGuestId will correct it
  showOnboardingPopup: false,
  sharedLinkMode: null,
  likedArticles: {},

  initializeGuestId: () => {
    if (typeof window === 'undefined') return;
    
    let id = localStorage.getItem('newser_guest_id');
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `guest_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('newser_guest_id', id);
    }

    const completed = localStorage.getItem('newser_onboarding_complete') === 'true';
    
    set({ 
      guestId: id,
      hasCompletedOnboarding: completed
    });
  },

  setArticles: (articles, hasMore) =>
    set({ articles, hasMore, page: 1, currentIndex: 0 }),

  appendArticles: (newArticles, hasMore) =>
    set((state) => ({
      articles: [...state.articles, ...newArticles],
      hasMore
    })),

  setCurrentIndex: (index) => set({ currentIndex: index }),
  setPage: (page) => set({ page }),
  setLoading: (loading) => set({ isLoading: loading }),
  
  // When setting category, we reset source to 'all' to avoid conflicting filters
  setCategory: (category) => set({ category, page: 1, articles: [], hasMore: true, currentIndex: 0, sort: 'foryou' }),
  setSource: (source) => set({ source, page: 1, articles: [], hasMore: true, currentIndex: 0, category: 'all', sort: 'foryou' }),
  setSort: (sort) => set({ sort, page: 1, articles: [], hasMore: true, currentIndex: 0, category: 'all', source: 'all' }),
  
  openDrawer: (article) => set({ drawerArticle: article, isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),

  setSharedLinkMode: (category) => set({ sharedLinkMode: category }),
  setShowOnboardingPopup: (show) => set({ showOnboardingPopup: show }),
  
  completeOnboarding: async (categories) => {
    const { guestId } = get();
    if (!guestId || categories.length === 0) return;
    
    try {
      // Bulk insert to backend
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await fetch(`${API_BASE}/api/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_id: guestId,
          categories: categories,
          score: 10
        })
      });
      
      // Save locally
      localStorage.setItem('newser_onboarding_complete', 'true');

      set({ 
        hasCompletedOnboarding: true,
        showOnboardingPopup: false,
        sharedLinkMode: null,
        sort: 'foryou',
        category: 'all',
        page: 1,
        articles: [],
        currentIndex: 0
      });
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
    }
  },

  toggleLike: (id) => set((state) => ({
    likedArticles: {
      ...state.likedArticles,
      [id]: !state.likedArticles[id]
    }
  }))
}));
