'use client';

import { useCallback, useState, useEffect } from 'react';
import { Heart, Share2, Bookmark } from 'lucide-react';
import type { Article } from '@/lib/api';
import { trackInteraction } from '@/lib/api';
import { useArticleStore } from '@/store/useArticleStore';
import { triggerHaptic } from '@/lib/haptics';
import ArticleMenu from './ArticleMenu';
import styles from './ArticleCard.module.css';

// Using CSS Ambient Glow technique to extract color visually instead of JS Canvas
// This completely bypasses all CORS restrictions

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// SVG Icons matching Figma vuesax/bold icons
function HeartIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21.65C11.69 21.65 11.39 21.61 11.14 21.52C7.32 20.21 1.25 15.56 1.25 8.69C1.25 5.19 4.08 2.35 7.56 2.35C9.25 2.35 10.83 3.01 12 4.19C13.17 3.01 14.75 2.35 16.44 2.35C19.92 2.35 22.75 5.19 22.75 8.69C22.75 15.56 16.68 20.21 12.86 21.52C12.61 21.61 12.31 21.65 12 21.65Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.62 20.81C12.28 20.93 11.72 20.93 11.38 20.81C8.48 19.82 2 15.69 2 8.69C2 5.6 4.49 3.1 7.56 3.1C9.38 3.1 10.99 3.98 12 5.34C13.01 3.98 14.63 3.1 16.44 3.1C19.51 3.1 22 5.6 22 8.69C22 15.69 15.52 19.82 12.62 20.81Z" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.82 2H7.18C5.05 2 3.32 3.74 3.32 5.86V19.95C3.32 21.75 4.61 22.51 6.19 21.64L11.07 18.93C11.59 18.64 12.43 18.64 12.94 18.93L17.82 21.64C19.4 22.52 20.69 21.76 20.69 19.95V5.86C20.68 3.74 18.95 2 16.82 2Z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.14 2.96L21.49 5.63C22.16 5.97 22.16 6.96 21.49 7.3L16.14 9.97C15.58 10.25 14.93 9.85 14.93 9.22V7.63C10.63 7.88 7.84 9.81 5.96 13.42C5.59 14.15 4.52 14.01 4.52 13.2C4.52 9.51 6.79 5.63 14.93 5.35V3.71C14.93 3.08 15.58 2.68 16.14 2.96Z" />
      <path d="M3.5 17V14.5C3.5 14.09 3.84 13.75 4.25 13.75C4.66 13.75 5 14.09 5 14.5V17C5 19.21 6.79 21 9 21H18C20.21 21 22 19.21 22 17V14.5C22 14.09 21.66 13.75 21.25 13.75C20.84 13.75 20.5 14.09 20.5 14.5V17C20.5 18.38 19.38 19.5 18 19.5H9C7.62 19.5 6.5 18.38 6.5 17H5V17C5 18.93 6.57 20.5 8.5 20.5V21C6.29 21 3.5 19.21 3.5 17Z" />
    </svg>
  );
}

interface ArticleCardProps {
  article: Article;
  isFocused?: boolean;
  priority?: boolean;
}

export default function ArticleCard({ article, isFocused = false, priority = false }: ArticleCardProps) {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [imgError, setImgError] = useState(false);
  const openDrawer = useArticleStore((s) => s.openDrawer);
  const guestId = useArticleStore((s) => s.guestId);
  const setCategory = useArticleStore((s) => s.setCategory);
  const setSource = useArticleStore((s) => s.setSource);

  useEffect(() => {
    // No JS extraction needed! Handled purely by CSS backdrop glow
  }, []);

  const handleReadMore = useCallback(() => {
    // On desktop (>= 1024px), the Reader is permanently open and automatically
    // syncs to the current scroll index. We don't want to open the mobile overlay
    // or hard-lock the active article to a click.
    if (window.innerWidth >= 1024) return;
    
    triggerHaptic('light');
    openDrawer(article);
    if (guestId) {
      trackInteraction(guestId, article.ai_category, 'read');
    }
  }, [article, openDrawer, guestId]);

  const handleShare = useCallback(async () => {
    triggerHaptic('light');
    if (guestId) {
      trackInteraction(guestId, article.ai_category, 'share');
    }
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title_hook,
          url: article.original_url
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(article.original_url);
    }
  }, [article, guestId]);

  const handleCategoryClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    setSource('all');
    setCategory(article.ai_category);
  }, [article.ai_category, setCategory, setSource]);

  const handleSourceClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    setCategory('all');
    setSource(article.source?.slug || 'all');
  }, [article.source?.slug, setCategory, setSource]);

  const cardStyle = {
    '--hero-image': article.image_url ? `url('${article.image_url}')` : 'none',
  } as React.CSSProperties;

  return (
    <div 
      className={styles.card} 
      id={`article-${article.id}`} 
      style={{ ...cardStyle, cursor: 'pointer' }}
      onClick={handleReadMore}
    >
      {/* Three-dot menu */}
      <ArticleMenu article={article} />

      {/* Hero Image */}
      {article.image_url && !imgError ? (
        <img
          className={styles.heroImage}
          src={article.image_url}
          alt=""
          loading={priority ? undefined : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={styles.heroImageFallback}>
          <span className={styles.fallbackIcon}>📰</span>
        </div>
      )}

      {/* Header gradient overlay */}
      <div className={styles.headerGradient} />

      {/* Content area */}
      <div className={`${styles.contentArea} ${isFocused ? styles.contentFocused : styles.contentHidden}`}>
        <div className={styles.contentGradient} />

        {/* Category badge */}
        {article.ai_category && (
          <div 
            className={styles.categoryBadge} 
            onClick={handleCategoryClick}
            style={{ cursor: 'pointer', zIndex: 10 }}
          >
            <span className={styles.categoryDot} />
            {article.ai_category}
          </div>
        )}

        {/* Title hook */}
        <h2 className={styles.titleHook}>{article.title_hook}</h2>

        {/* Action row with source info on the left */}
        <div className={styles.actionRow} onClick={(e) => e.stopPropagation()}>
          {/* Source info */}
          {article.source && (
            <div 
              className={styles.sourceInfo} 
              onClick={handleSourceClick}
              style={{ cursor: 'pointer', zIndex: 10 }}
            >
              {article.source.logo_url && (
                <img
                  className={styles.sourceLogo}
                  src={article.source.logo_url}
                  alt=""
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <span className={styles.sourceName} style={{ textDecoration: 'underline', textDecorationColor: 'transparent', transition: 'text-decoration-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.textDecorationColor = 'rgba(255,255,255,0.5)'} onMouseLeave={(e) => e.currentTarget.style.textDecorationColor = 'transparent'}>
                {article.source.name}
              </span>
              <span className={styles.sourceDivider} />
              <span className={styles.sourceTime}>{timeAgo(article.published_at)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Skeleton loading state
export function ArticleCardSkeleton() {
  return (
    <div className={styles.skeletonCard}>
      <div className={`${styles.skeletonImage} skeleton`} />
      <div className={styles.skeletonContent}>
        <div className={`${styles.skeletonBadge} skeleton`} />
        <div className={`${styles.skeletonTitle} skeleton`} />
        <div className={`${styles.skeletonTitle2} skeleton`} />
        <div className={styles.skeletonRow}>
          <div className={`${styles.skeletonBtn} skeleton`} />
        </div>
      </div>
    </div>
  );
}
