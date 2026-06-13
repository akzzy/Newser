'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useArticleStore } from '@/store/useArticleStore';
import { triggerHaptic } from '@/lib/haptics';
import styles from './ReaderDrawer.module.css';

/**
 * Simple markdown-to-HTML converter.
 * Handles: bold, italic, headers, lists, tables, blockquotes, inline code.
 */
function renderMarkdown(md: string): string {
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr/>');

  // Tables — parse line by line (regex is too brittle for multiline tables)
  {
    const lines = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      const nextLine = lines[i + 1]?.trim() ?? '';
      // Detect table: current line is a row, next line is a separator like |---|---|
      if (line.startsWith('|') && /^\|[\s\-|:]+\|$/.test(nextLine)) {
        const headers = line.split('|').map((h: string) => h.trim()).filter(Boolean);
        i += 2; // skip header + separator
        const rows: string[][] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          const cells = lines[i].split('|').map((c: string) => c.trim()).filter(Boolean);
          rows.push(cells);
          i++;
        }
        out.push(`<table><thead><tr>${headers.map((h: string) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r: string[]) => `<tr>${r.map((c: string) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      } else {
        out.push(lines[i]);
        i++;
      }
    }
    html = out.join('\n');
  }

  // Lists (unordered)
  html = html.replace(/^[*-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<\/li>)\s+(<li>)/g, '$1\n$2'); // collapse blank lines between bullets
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (match) => `<ul>${match.trim()}</ul>`);

  // Paragraphs (wrap remaining non-tag lines)
  html = html
    .split('\n\n')
    .map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<')) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');

  return html;
}

export default function ReaderDrawer() {
  const { drawerArticle, isDrawerOpen, closeDrawer, articles, currentIndex } = useArticleStore();
  
  // Use the explicitly opened article (mobile) or default to the current feed article (desktop auto-sync)
  const activeArticle = drawerArticle || articles[currentIndex];
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragLocked, setDragLocked] = useState(false);
  const isDraggingRef = useRef(false);

  // Sync dragging state to ref for native event listener
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // Non-passive native event listener to completely block browser rubber-banding
  useEffect(() => {
    const preventNativeScroll = (e: TouchEvent) => {
      if (isDraggingRef.current) {
        e.preventDefault();
      }
    };
    
    // Attach to document to catch all rogue overscrolls
    document.addEventListener('touchmove', preventNativeScroll, { passive: false });
    return () => document.removeEventListener('touchmove', preventNativeScroll);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setCurrentY(e.touches[0].clientY);
    setIsDragging(false);
    setDragLocked(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragLocked) return;

    const y = e.touches[0].clientY;
    const dy = y - startY;
    
    if (!isDragging) {
      if (Math.abs(dy) > 5) {
        if (dy > 0) {
          // Pulling DOWN
          const target = e.target as HTMLElement;
          const scrollContainer = target.closest(`.${styles.drawerContent}`);
          
          if (!scrollContainer || scrollContainer.scrollTop <= 3) {
            setIsDragging(true);
            setStartY(y);
            setCurrentY(y);
          } else {
            setDragLocked(true);
          }
        } else {
          // Pulling UP
          setDragLocked(true);
        }
      }
      return;
    }
    
    // If dragging, record position. Native listener handles preventDefault.
    if (y > startY) {
      setCurrentY(y);
    } else {
      setCurrentY(startY);
    }
  };

  const handleTouchEnd = () => {
    if (isDragging) {
      const diff = currentY - startY;
      if (diff > 80) {
        triggerHaptic('light');
        closeDrawer();
      }
    }
    setIsDragging(false);
    setDragLocked(false);
    setStartY(0);
    setCurrentY(0);
  };

  const dragOffset = isDragging ? Math.max(0, currentY - startY) : 0;
  
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const wheelLockRef = useRef(false);

  // Desktop smooth article transition on scroll
  useEffect(() => {
    const container = contentScrollRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Only apply on desktop
      if (window.innerWidth < 1024) return;

      if (wheelLockRef.current) {
        e.preventDefault();
        return;
      }

      const isAtTop = container.scrollTop <= 0;
      // If clientHeight is larger than scrollHeight, it's a short article and isAtBottom is true
      const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;

      if (e.deltaY < 0 && isAtTop) {
        e.preventDefault();
        const feed = document.getElementById('main-feed-container');
        if (feed && feed.scrollTop > 0) {
          wheelLockRef.current = true;
          feed.scrollBy({ top: -feed.clientHeight, behavior: 'smooth' });
          setTimeout(() => { wheelLockRef.current = false; }, 500);
        }
      } else if (e.deltaY > 0 && isAtBottom) {
        e.preventDefault();
        const feed = document.getElementById('main-feed-container');
        if (feed && feed.scrollTop < feed.scrollHeight - feed.clientHeight - 1) {
          wheelLockRef.current = true;
          feed.scrollBy({ top: feed.clientHeight, behavior: 'smooth' });
          setTimeout(() => { wheelLockRef.current = false; }, 500);
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen) closeDrawer();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, closeDrawer]);

  // Prevent body scroll and native pull-to-refresh when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehaviorY = 'none';
      document.documentElement.style.overscrollBehaviorY = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.overscrollBehaviorY = '';
      document.documentElement.style.overscrollBehaviorY = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.overscrollBehaviorY = '';
      document.documentElement.style.overscrollBehaviorY = '';
    };
  }, [isDrawerOpen]);

  // Hardware back button support for mobile
  useEffect(() => {
    // Only apply on mobile where the drawer actually covers the screen
    if (isDrawerOpen && typeof window !== 'undefined' && window.innerWidth < 1024) {
      // Push a dummy state to the history stack
      window.history.pushState({ drawerOpen: true }, '');

      const handlePopState = () => {
        // User pressed the system back button / swiped back
        closeDrawer();
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        // If the drawer was closed programmatically (swipe down, close button)
        // rather than via the back button, we need to clean up the history stack
        if (window.history.state?.drawerOpen) {
          window.history.back();
        }
      };
    }
  }, [isDrawerOpen, closeDrawer]);

  const handleOverlayClick = useCallback(() => {
    triggerHaptic('light');
    closeDrawer();
  }, [closeDrawer]);

  const deepDiveHtml = activeArticle?.deep_dive_content
    ? renderMarkdown(activeArticle.deep_dive_content)
    : '<p>No content available.</p>';

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`${styles.overlay} ${isDrawerOpen ? styles.overlayVisible : ''}`}
        onClick={handleOverlayClick}
        aria-hidden="true"
        style={{
          // Fade the backdrop slightly as they pull down
          opacity: isDragging ? Math.max(0, 1 - (dragOffset / 400)) : undefined,
          transition: isDragging ? 'none' : undefined
        }}
      />

      {/* Drawer panel */}
      <div
        className={`${styles.drawer} ${isDrawerOpen ? styles.drawerOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Article details"
        style={{
          // Physically move the drawer with the thumb, bypassing CSS transition
          transform: isDragging ? `translateY(${dragOffset}px)` : undefined,
          transition: isDragging ? 'none' : undefined
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className={styles.dragHandle}>
          <div className={styles.dragBar} />
        </div>

        {activeArticle && (
          <div key={activeArticle.id} className={styles.desktopAnimateGroup}>
            {/* Header */}
            <div className={styles.drawerHeader}>
              {activeArticle.source && (
                <div className={styles.sourceChip}>
                  {activeArticle.source.logo_url && (
                    <img
                      className={styles.sourceChipLogo}
                      src={activeArticle.source.logo_url}
                      alt=""
                    />
                  )}
                  {activeArticle.source.name}
                </div>
              )}

              {activeArticle.read_time && (
                <div className={styles.readTimeBadge}>
                  {activeArticle.read_time} read
                </div>
              )}

              <button
                className={styles.closeBtn}
                onClick={() => {
                  triggerHaptic('light');
                  closeDrawer();
                }}
                aria-label="Close"
                id="drawer-close"
              >
                ✕
              </button>
            </div>

            {/* Scrollable content */}
            <div className={styles.drawerContent} ref={contentScrollRef}>
              <div
                className={styles.markdown}
                dangerouslySetInnerHTML={{ __html: deepDiveHtml }}
              />
            </div>

            {/* Footer with original link */}
            <div className={styles.drawerFooter}>
              <a
                href={activeArticle.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.originalLink}
                id="original-article-link"
              >
                <span className={styles.originalLinkIcon}>↗</span>
                Read original article
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
