'use client';

import { create } from 'zustand';
import type { Article } from '@/lib/api';

type PrefType = 'tag' | 'category' | 'source';

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
  setArticles: (articles: Article[], hasMore: boolean, userInterests?: string[]) => void;
  appendArticles: (articles: Article[], hasMore: boolean, userInterests?: string[]) => void;
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

  // Preferences (block / boost / backend interests)
  userInterests: string[];
  blockedTags: string[];
  blockedCategories: string[];
  blockedSources: string[];
  boostedTags: string[];
  boostedCategories: string[];
  boostedSources: string[];
  initializePreferences: () => void;
  blockItem: (type: PrefType, value: string) => void;
  boostItem: (type: PrefType, value: string) => void;
  unblockItem: (type: PrefType, value: string) => void;
  unboostItem: (type: PrefType, value: string) => void;
  isArticleBlocked: (article: Article) => boolean;
  getBoostScore: (article: Article) => number;
}

// Helper to read a JSON array from localStorage
function loadList(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// Helper to persist a JSON array to localStorage
function saveList(key: string, list: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(list));
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
  userInterests: [],

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

  setArticles: (articles, hasMore, userInterests) =>
    set((state) => ({ 
      articles, 
      hasMore, 
      page: 1, 
      currentIndex: 0,
      userInterests: userInterests || state.userInterests 
    })),

  appendArticles: (newArticles, hasMore, userInterests) =>
    set((state) => ({
      articles: [...state.articles, ...newArticles],
      hasMore,
      userInterests: userInterests || state.userInterests
    })),

  setCurrentIndex: (index) => set({ currentIndex: index }),
  setPage: (page) => set({ page }),
  setLoading: (loading) => set({ isLoading: loading }),
  
  // When setting category, we reset source to 'all' to avoid conflicting filters
  setCategory: (category) => set({ 
    category, 
    source: 'all',
    page: 1, 
    articles: [], 
    hasMore: true, 
    currentIndex: 0, 
    sort: category === 'all' ? 'foryou' : 'latest' 
  }),
  setSource: (source) => set({ source, page: 1, articles: [], hasMore: true, currentIndex: 0, category: 'all', sort: 'latest' }),
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
  })),

  // ── Preferences ──
  blockedTags: [],
  blockedCategories: [],
  blockedSources: [],
  boostedTags: [],
  boostedCategories: [],
  boostedSources: [],

  initializePreferences: () => {
    set({
      blockedTags: loadList('newser_blocked_tags'),
      blockedCategories: loadList('newser_blocked_categories'),
      blockedSources: loadList('newser_blocked_sources'),
      boostedTags: loadList('newser_boosted_tags'),
      boostedCategories: loadList('newser_boosted_categories'),
      boostedSources: loadList('newser_boosted_sources'),
    });
  },

  blockItem: (type, value) => {
    const state = get();
    const key = type === 'tag' ? 'blockedTags' : type === 'category' ? 'blockedCategories' : 'blockedSources';
    const storageKey = `newser_blocked_${type === 'tag' ? 'tags' : type === 'category' ? 'categories' : 'sources'}`;
    if (state[key].includes(value)) return;
    const updated = [...state[key], value];
    saveList(storageKey, updated);
    set({ [key]: updated } as Partial<ArticleStore>);
  },

  boostItem: (type, value) => {
    const state = get();
    const key = type === 'tag' ? 'boostedTags' : type === 'category' ? 'boostedCategories' : 'boostedSources';
    const storageKey = `newser_boosted_${type === 'tag' ? 'tags' : type === 'category' ? 'categories' : 'sources'}`;
    if (state[key].includes(value)) return;
    const updated = [...state[key], value];
    saveList(storageKey, updated);
    set({ [key]: updated } as Partial<ArticleStore>);
  },

  unblockItem: (type, value) => {
    const state = get();
    const key = type === 'tag' ? 'blockedTags' : type === 'category' ? 'blockedCategories' : 'blockedSources';
    const storageKey = `newser_blocked_${type === 'tag' ? 'tags' : type === 'category' ? 'categories' : 'sources'}`;
    const updated = state[key].filter((v: string) => v !== value);
    saveList(storageKey, updated);
    set({ [key]: updated } as Partial<ArticleStore>);
  },

  unboostItem: (type, value) => {
    const state = get();
    const key = type === 'tag' ? 'boostedTags' : type === 'category' ? 'boostedCategories' : 'boostedSources';
    const storageKey = `newser_boosted_${type === 'tag' ? 'tags' : type === 'category' ? 'categories' : 'sources'}`;
    const updated = state[key].filter((v: string) => v !== value);
    saveList(storageKey, updated);
    set({ [key]: updated } as Partial<ArticleStore>);
  },

  isArticleBlocked: (article) => {
    const state = get();
    if (article.ai_tags?.some((tag: string) => state.blockedTags.includes(tag))) return true;
    if (state.blockedCategories.includes(article.ai_category)) return true;
    if (article.source && state.blockedSources.includes(article.source.slug)) return true;
    return false;
  },

  getBoostScore: (article) => {
    const state = get();
    let score = 0;
    if (article.ai_tags?.some((tag: string) => state.boostedTags.includes(tag))) score += 2;
    if (state.boostedCategories.includes(article.ai_category)) score += 3;
    if (article.source && state.boostedSources.includes(article.source.slug)) score += 1;
    return score;
  },
}));
