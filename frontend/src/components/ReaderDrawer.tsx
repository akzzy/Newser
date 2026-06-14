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

  // ── Swipe-to-dismiss gesture (mobile only) ──
  // All gesture tracking lives in a single ref to avoid stale closures in native listeners.
  // React state is only used for visual output (triggers re-render for transform/opacity).
  const drawerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef({
    startY: 0,
    isDragging: false,
    dragLocked: false,
    currentOffset: 0,
    scrollContainer: null as HTMLElement | null,
  });
  const [dragVisual, setDragVisual] = useState({ active: false, offset: 0 });
  const closeDrawerRef = useRef(closeDrawer);
  closeDrawerRef.current = closeDrawer;

  // Attach native touch listeners directly to the drawer element.
  // { passive: false } is CRITICAL — it lets us call preventDefault() BEFORE the
  // browser's scroll engine claims the touch on .drawerContent.
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;

    const onTouchStart = (e: TouchEvent) => {
      const g = gestureRef.current;
      g.startY = e.touches[0].clientY;
      g.isDragging = false;
      g.dragLocked = false;
      g.currentOffset = 0;

      const target = e.target as HTMLElement;
      g.scrollContainer = target.closest(`.${styles.drawerContent}`) as HTMLElement | null;

      setDragVisual({ active: false, offset: 0 });
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!e.touches.length) return;
      const y = e.touches[0].clientY;
      const g = gestureRef.current;

      // Already dragging — track the finger and block native scroll
      if (g.isDragging) {
        e.preventDefault();
        g.currentOffset = Math.max(0, y - g.startY);
        setDragVisual({ active: true, offset: g.currentOffset });
        return;
      }

      // Locked to upward content scrolling for this gesture
      if (g.dragLocked) return;

      const dy = y - g.startY;

      // Pulling UP — lock to content scroll, don't interfere
      if (dy < -10) {
        g.dragLocked = true;
        return;
      }

      // Pulling DOWN — check if content is at the top
      if (dy > 5) {
        const sc = g.scrollContainer;
        const isAtTop = !sc || sc.scrollTop <= 1;

        if (isAtTop) {
          // Content has nowhere to scroll — hijack the touch for drag-to-dismiss
          e.preventDefault(); // BLOCK native scroll BEFORE browser claims it
          g.isDragging = true;
          g.startY = y; // Anchor from here so offset starts at 0
          g.currentOffset = 0;
          setDragVisual({ active: true, offset: 0 });
        }
        // If content is NOT at top: do nothing. Let native scroll continue.
        // On the next touchmove, if the user has scrolled to the top, we'll catch it.
      }
    };

    const onTouchEnd = () => {
      const g = gestureRef.current;
      if (g.isDragging && g.currentOffset > 80) {
        triggerHaptic('light');
        closeDrawerRef.current();
      }
      g.isDragging = false;
      g.dragLocked = false;
      g.currentOffset = 0;
      setDragVisual({ active: false, offset: 0 });
    };

    drawer.addEventListener('touchstart', onTouchStart, { passive: true });
    drawer.addEventListener('touchmove', onTouchMove, { passive: false });
    drawer.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      drawer.removeEventListener('touchstart', onTouchStart);
      drawer.removeEventListener('touchmove', onTouchMove);
      drawer.removeEventListener('touchend', onTouchEnd);
    };
  }, []);
  
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const wheelLockRef = useRef(false);

  // Desktop smooth article transition on scroll
  // Re-attach when the active article changes because key={id} remounts the DOM subtree
  const activeArticleId = activeArticle?.id;
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
      const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 2;

      if (e.deltaY < 0 && isAtTop) {
        e.preventDefault();
        const feed = document.getElementById('main-feed-container');
        if (feed && feed.scrollTop > 0) {
          wheelLockRef.current = true;
          feed.scrollBy({ top: -feed.clientHeight, behavior: 'smooth' });
          setTimeout(() => { wheelLockRef.current = false; }, 600);
        }
      } else if (e.deltaY > 0 && isAtBottom) {
        e.preventDefault();
        const feed = document.getElementById('main-feed-container');
        if (feed && feed.scrollTop < feed.scrollHeight - feed.clientHeight - 1) {
          wheelLockRef.current = true;
          feed.scrollBy({ top: feed.clientHeight, behavior: 'smooth' });
          setTimeout(() => { wheelLockRef.current = false; }, 600);
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [activeArticleId]);

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
          opacity: dragVisual.active ? Math.max(0, 1 - (dragVisual.offset / 400)) : undefined,
          transition: dragVisual.active ? 'none' : undefined
        }}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={`${styles.drawer} ${isDrawerOpen ? styles.drawerOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Article details"
        style={{
          // Physically move the drawer with the thumb, bypassing CSS transition
          transform: dragVisual.active ? `translateY(${dragVisual.offset}px)` : undefined,
          transition: dragVisual.active ? 'none' : undefined
        }}
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
