'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Heart, Send } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';
import { useArticleStore } from '@/store/useArticleStore';
import { trackInteraction } from '@/lib/api';
import styles from './FloatingActionBar.module.css';

export default function FloatingActionBar() {
  const pathname = usePathname();
  
  // Connect to global store for context-aware actions
  const { articles, currentIndex, likedArticles, toggleLike, isDrawerOpen, guestId, setCategory } = useArticleStore();

  // Hide completely on admin pages
  if (pathname.startsWith('/system-ops')) {
    return null;
  }

  // Determine if we are on a page that supports reading an article (Feed, Channel Feed, or a Deep Link)
  const isSharedArticle = pathname.startsWith('/a/');
  const isFeedView = pathname === '/' || isSharedArticle;

  const handleTap = () => triggerHaptic('light');

  const handleFeedClick = () => {
    triggerHaptic('light');
    // Always reset to 'For You' when explicitly tapping the home feed button
    setCategory('all');
  };

  // Handle Like Action
  const handleLike = () => {
    if (!isFeedView || articles.length === 0) return;
    const currentArticle = articles[currentIndex];
    if (currentArticle) {
      triggerHaptic('medium');
      toggleLike(currentArticle.id);
      if (guestId && !likedArticles[currentArticle.id]) {
        trackInteraction(guestId, currentArticle.ai_category, 'like');
      }
    }
  };

  // Handle Share Action
  const handleShare = async () => {
    if (!isFeedView || articles.length === 0) return;
    const currentArticle = articles[currentIndex];
    if (!currentArticle) return;

    triggerHaptic('medium');
    
    if (guestId) {
      trackInteraction(guestId, currentArticle.ai_category, 'share');
    }

    try {
      const shareUrl = `${window.location.origin}/a/${currentArticle.id}`;
      
      if (navigator.share) {
        await navigator.share({
          title: currentArticle.title_hook,
          text: 'Check out this news on 1Minute!',
          url: shareUrl,
        });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      } else {
        // Fallback for HTTP (non-secure) local mobile dev where clipboard API is disabled
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          alert('Link copied to clipboard!');
        } catch (err) {
          alert('Unable to copy. Share Link: ' + shareUrl);
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  // Check which tab is active
  const isFeedTab = pathname === '/' || isSharedArticle;
  const isDiscoverTab = pathname === '/discover';

  const currentArticle = articles[currentIndex];
  const isLiked = currentArticle ? !!likedArticles[currentArticle.id] : false;

  return (
    <div className={`${styles.barContainer} ${isDrawerOpen ? styles.hidden : ''}`}>
      <div className={styles.floatingBar}>
        
        {/* Feed Tab */}
        <Link 
          href="/" 
          className={`${styles.barButton} ${styles.desktopHide} ${isFeedTab ? styles.expandedPill : styles.iconOnly}`}
          onClick={handleFeedClick}
        >
          {isFeedTab ? <span className={styles.pillText}>Feed</span> : <Home size={22} />}
        </Link>
        
        {/* Discover Tab */}
        <Link 
          href="/discover" 
          className={`${styles.barButton} ${styles.desktopHide} ${isDiscoverTab ? styles.expandedPill : styles.iconOnly}`}
          onClick={handleTap}
        >
          {isDiscoverTab ? <span className={styles.pillText}>Discover</span> : <Compass size={22} />}
        </Link>

        {/* Action Buttons (Only visible when reading a feed) */}
        {isFeedView && (
          <>
            <button 
              className={`${styles.barButton} ${styles.actionBtn}`} 
              onClick={handleShare}
              aria-label="Share"
            >
              <Send size={20} />
            </button>
            
            <button 
              className={`${styles.barButton} ${styles.actionBtn} ${isLiked ? styles.liked : ''}`} 
              onClick={handleLike}
              aria-label="Like"
            >
              <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
            </button>
          </>
        )}

      </div>
    </div>
  );
}
