'use client';

import { useEffect, useLayoutEffect, useRef, useCallback, useState } from 'react';
import { useArticleStore } from '@/store/useArticleStore';
import { fetchArticles, fetchCategories, trackInteraction } from '@/lib/api';
import { triggerHaptic } from '@/lib/haptics';
import ArticleCard, { ArticleCardSkeleton } from './ArticleCard';
import ReaderDrawer from './ReaderDrawer';
import styles from './Feed.module.css';

export default function Feed() {
  const {
    articles,
    currentIndex,
    page,
    hasMore,
    isLoading,
    category,
    setArticles,
    appendArticles,
    setCurrentIndex,
    setPage,
    setLoading,
    setCategory,
    source,
    setSource,
    sort,
    isDrawerOpen,
    guestId,
    hasCompletedOnboarding,
    showOnboardingPopup,
    sharedLinkMode,
    setShowOnboardingPopup,
    initializeGuestId,
    initializePreferences,
    isArticleBlocked
  } = useArticleStore();

  // Initialize guest ID and preferences on first mount
  useEffect(() => {
    initializeGuestId();
    initializePreferences();
  }, [initializeGuestId, initializePreferences]);

  const feedRef = useRef<HTMLDivElement>(null);
  
  // Pull to refresh state
  const [ptrStartY, setPtrStartY] = useState(0);
  const [ptrOffset, setPtrOffset] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [categories, setCategories] = useState<string[]>(['all']);

  // Load categories
  useEffect(() => {
    fetchCategories().then(setCategories).catch(console.error);
  }, []);

  // Restore scroll position on mount, and defeat browser scroll anchoring on refresh
  const topArticleId = articles[0]?.id;
  useLayoutEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = currentIndex * feedRef.current.clientHeight;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topArticleId]);

  // Load articles
  const loadArticles = useCallback(async (pageNum: number, cat: string, src: string, sortOrder: string, replace = false) => {
    setLoading(true);
    try {
      const data = await fetchArticles(pageNum, 20, cat, src, sortOrder, guestId);
      if (replace) {
        setArticles(data.articles, data.pagination.has_more);
      } else {
        appendArticles(data.articles, data.pagination.has_more);
      }
    } catch (err) {
      console.error('Failed to load articles:', err);
    } finally {
      setLoading(false);
    }
  }, [setArticles, appendArticles, setLoading, guestId]);

  // Initial load
  useEffect(() => {
    // Only auto-load if NOT on a shared link page (SingleArticleClient handles the initial load for shared links)
    const isSharedPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/a/');
    if (guestId !== null && articles.length === 0 && !isSharedPage) {
      loadArticles(1, category, source, sort, true);
    }
  }, [category, source, sort, loadArticles, guestId, articles.length]);

  // Track current card via scroll position
  const handleScroll = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;

    const scrollTop = el.scrollTop;
    const cardHeight = el.clientHeight;
    const newIndex = Math.round(scrollTop / cardHeight);

    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      
      // Delayed onboarding trigger for all users (after 4 swipes)
      if (!hasCompletedOnboarding && !showOnboardingPopup && newIndex >= 4) {
        setShowOnboardingPopup(true);
      }
    }

    // Preload more when near end
    if (newIndex >= articles.length - 3 && hasMore && !isLoading) {
      const nextPage = page + 1;
      setPage(nextPage);
      
      // If user arrived via shared link, continuation depends on onboarding status
      if (sharedLinkMode) {
        if (hasCompletedOnboarding) {
          // Existing user: continue with personalized feed
          loadArticles(nextPage, 'all', 'all', 'foryou');
        } else {
          // New user: continue with same category as shared article
          loadArticles(nextPage, sharedLinkMode, 'all', 'latest');
        }
      } else {
        loadArticles(nextPage, category, source, sort);
      }
    }
  }, [articles.length, currentIndex, hasMore, isLoading, page, category, source, sort, setCurrentIndex, setPage, loadArticles, sharedLinkMode, hasCompletedOnboarding, showOnboardingPopup, setShowOnboardingPopup]);

  // Category change handler
  const handleCategoryChange = useCallback((cat: string) => {
    setCategory(cat);
    feedRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [setCategory]);

  // Pull to refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (feedRef.current?.scrollTop === 0) {
      setPtrStartY(e.touches[0].clientY);
    } else {
      setPtrStartY(0);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (ptrStartY === 0 || isRefreshing) return;
    
    const y = e.touches[0].clientY;
    const dy = y - ptrStartY;
    
    // Only pull if we are at the top and pulling down
    if (dy > 0 && feedRef.current?.scrollTop === 0) {
      // Apply physical resistance to the pull
      const resistance = Math.max(0, dy * 0.4);
      setPtrOffset(Math.min(resistance, 100)); // Cap at 100px
      if (e.cancelable) e.preventDefault(); // Stop any native bounce
    }
  };

  const handleTouchEnd = async () => {
    if (ptrOffset > 60 && !isRefreshing) {
      setIsRefreshing(true);
      triggerHaptic('medium');
      setPtrOffset(40); // Stick open while loading
      await loadArticles(1, category, source, sort, true); // True forces a fresh replacement
      
      // Aggressively defeat Safari/Mobile scroll anchoring
      let frames = 0;
      const forceScroll = () => {
        if (feedRef.current) feedRef.current.scrollTop = 0;
        if (frames < 5) {
          frames++;
          requestAnimationFrame(forceScroll);
        }
      };
      requestAnimationFrame(forceScroll);

      setIsRefreshing(false);
      setPtrOffset(0); // Snap shut
    } else {
      setPtrOffset(0); // Snap shut immediately if not pulled far enough
    }
    setPtrStartY(0);
  };

  const handleLogoClick = async () => {
    triggerHaptic('light');
    
    // Instant scroll to top before refresh
    feedRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    
    // Trigger the pull-to-refresh style load
    if (!isRefreshing) {
      setIsRefreshing(true);
      setPtrOffset(40); // Show the spinner so they know it's loading
      setPage(1);
      await loadArticles(1, category, source, sort, true);
      triggerHaptic('medium');
      
      // Aggressively defeat Safari/Mobile scroll anchoring
      let frames = 0;
      const forceScroll = () => {
        if (feedRef.current) feedRef.current.scrollTop = 0;
        if (frames < 5) {
          frames++;
          requestAnimationFrame(forceScroll);
        }
      };
      requestAnimationFrame(forceScroll);

      setIsRefreshing(false);
      setPtrOffset(0);
    }
  };

  return (
    <>
      {/* Fixed header */}
      <header className={styles.header}>
        <button className={styles.logo} onClick={handleLogoClick} aria-label="Refresh feed">
          NEWSER
        </button>
      </header>

      {/* Category tabs */}
      {categories.length > 1 && (
        <nav className={styles.categoryBar}>
          <div className={styles.categoryScroll}>
            {categories.map((cat) => {
              if (cat === 'all' && !hasCompletedOnboarding) return null;
              
              return (
                <button
                  key={cat}
                  className={`${styles.categoryTab} ${cat === category ? styles.categoryTabActive : ''}`}
                  onClick={() => handleCategoryChange(cat)}
                  id={`category-${cat}`}
                >
                  {cat === 'all' ? 'For You' : cat}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Scroll position dots */}
      {articles.length > 1 && (
        <div className={styles.scrollIndicator}>
          {articles.slice(0, Math.min(articles.length, 8)).map((_, i) => (
            <div
              key={i}
              className={`${styles.scrollDot} ${i === currentIndex ? styles.scrollDotActive : ''}`}
            />
          ))}
        </div>
      )}

      {/* Pull to Refresh Spinner */}
      <div 
        className={styles.ptrContainer}
        style={{
          transform: `translateY(${ptrOffset - 60}px)`,
          opacity: ptrOffset > 10 ? 1 : 0,
          transition: isRefreshing ? 'transform 0.3s ease, opacity 0.3s ease' : ptrStartY === 0 ? 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'
        }}
      >
        <div 
          className={`${styles.ptrSpinner} ${(isRefreshing || ptrOffset > 60) ? styles.ptrSpinning : ''}`}
          style={{ transform: (!isRefreshing && ptrOffset <= 60) ? `rotate(${ptrOffset * 5}deg)` : undefined }}
        />
      </div>

      {/* Snap-scroll feed */}
      <div
        ref={feedRef}
        className={`${styles.feedContainer} hide-scrollbar`}
        style={{
          transform: `translateY(${ptrOffset}px)`,
          transition: isRefreshing ? 'transform 0.3s ease' : ptrStartY === 0 ? 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
          overflowY: isRefreshing ? 'hidden' : 'scroll'
        }}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {articles.length === 0 && isLoading ? (
          // Skeleton loading
          <>
            <ArticleCardSkeleton />
            <ArticleCardSkeleton />
          </>
        ) : articles.length === 0 ? (
          // Empty state
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📡</span>
            <p className={styles.emptyText}>No articles yet</p>
            <p className={styles.emptySubtext}>
              Articles are being processed. Check back in a moment.
            </p>
          </div>
        ) : (
          // Article cards (filtered by preferences)
          articles.filter((a) => !isArticleBlocked(a)).map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))
        )}
      </div>

      {/* Reader drawer */}
      <ReaderDrawer />
    </>
  );
}
