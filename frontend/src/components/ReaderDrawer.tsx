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
  // Industry-standard approach (same as Vaul/Radix bottom sheets):
  //   - Set touch-action: none on the drawer (via CSS) so the browser's compositor
  //     never claims the touch gesture for native scrolling.
  //   - Handle ALL touch input in JavaScript: scroll the content manually when reading,
  //     switch to drag-to-dismiss when content is at the top.
  // This is the ONLY reliable way on mobile Chrome/Safari. The compositor's "fast path"
  // scrolling ignores e.preventDefault() once it starts — no JS workaround exists.
  const drawerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef({
    startY: 0,
    lastY: 0,
    isDragging: false,
    isScrolling: false,
    currentOffset: 0,
    scrollContainer: null as HTMLElement | null,
    velocity: 0,
    lastMoveTime: 0,
  });
  const [dragVisual, setDragVisual] = useState({ active: false, offset: 0 });
  const closeDrawerRef = useRef(closeDrawer);
  closeDrawerRef.current = closeDrawer;
  const momentumRef = useRef<number>(0);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    // Only apply on mobile
    if (window.innerWidth >= 1024) return;

    const onTouchStart = (e: TouchEvent) => {
      // Cancel any ongoing momentum scroll
      if (momentumRef.current) {
        cancelAnimationFrame(momentumRef.current);
        momentumRef.current = 0;
      }

      const g = gestureRef.current;
      const y = e.touches[0].clientY;
      g.startY = y;
      g.lastY = y;
      g.isDragging = false;
      g.isScrolling = false;
      g.currentOffset = 0;
      g.velocity = 0;
      g.lastMoveTime = Date.now();

      const target = e.target as HTMLElement;
      g.scrollContainer = target.closest(`.${styles.drawerContent}`) as HTMLElement | null;

      setDragVisual({ active: false, offset: 0 });
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!e.touches.length) return;
      e.preventDefault(); // ALWAYS prevent — we handle everything manually

      const y = e.touches[0].clientY;
      const g = gestureRef.current;
      const delta = y - g.lastY; // positive = finger moving down
      const now = Date.now();
      const timeDelta = now - g.lastMoveTime;

      // Track velocity for momentum
      if (timeDelta > 0) {
        g.velocity = delta / timeDelta;
      }
      g.lastMoveTime = now;
      g.lastY = y;

      const sc = g.scrollContainer;
      const isAtTop = !sc || sc.scrollTop <= 0;
      const isAtBottom = !sc || sc.scrollTop >= sc.scrollHeight - sc.clientHeight - 1;

      if (g.isDragging) {
        // ── DRAG MODE: move the drawer down ──
        if (delta < 0) {
          // Finger moving UP while dragging — reduce offset or switch back to scrolling
          g.currentOffset = Math.max(0, g.currentOffset + delta);
          if (g.currentOffset <= 0) {
            // Snapped back to origin — switch to scroll mode
            g.isDragging = false;
            g.isScrolling = true;
            g.currentOffset = 0;
            setDragVisual({ active: false, offset: 0 });
            return;
          }
        } else {
          g.currentOffset += delta;
        }
        setDragVisual({ active: true, offset: g.currentOffset });
        return;
      }

      // ── Not dragging yet — handle scroll or start drag ──
      if (delta > 0 && isAtTop) {
        // Finger moving DOWN and content is at the top → enter drag mode
        g.isDragging = true;
        g.isScrolling = false;
        g.startY = y;
        g.currentOffset = 0;
        setDragVisual({ active: true, offset: 0 });
        return;
      }

      // Normal scrolling — manually apply delta to scrollTop
      if (sc) {
        if (delta < 0) {
          // Finger moving UP → scroll content down (read more)
          sc.scrollTop -= delta; // delta is negative, so this adds
        } else if (delta > 0) {
          // Finger moving DOWN → scroll content up (go back)
          sc.scrollTop -= delta; // delta is positive, so this subtracts
        }
        g.isScrolling = true;
      }
    };

    const onTouchEnd = () => {
      const g = gestureRef.current;

      if (g.isDragging && g.currentOffset > 80) {
        // Dismiss
        triggerHaptic('light');
        closeDrawerRef.current();
      } else if (g.isDragging) {
        // Snap back (CSS transition handles the animation)
      }

      // Apply momentum scrolling if we were scrolling content
      if (g.isScrolling && g.scrollContainer && Math.abs(g.velocity) > 0.1) {
        let velocity = -g.velocity * 800; // Convert to px/frame, invert for scrollTop
        const sc = g.scrollContainer;
        const friction = 0.95;

        const step = () => {
          if (Math.abs(velocity) < 0.5) return;
          sc.scrollTop += velocity * 0.016; // ~16ms per frame
          velocity *= friction;
          momentumRef.current = requestAnimationFrame(step);
        };
        momentumRef.current = requestAnimationFrame(step);
      }

      g.isDragging = false;
      g.isScrolling = false;
      g.currentOffset = 0;
      setDragVisual({ active: false, offset: 0 });
    };

    drawer.addEventListener('touchstart', onTouchStart, { passive: false });
    drawer.addEventListener('touchmove', onTouchMove, { passive: false });
    drawer.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      drawer.removeEventListener('touchstart', onTouchStart);
      drawer.removeEventListener('touchmove', onTouchMove);
      drawer.removeEventListener('touchend', onTouchEnd);
      if (momentumRef.current) cancelAnimationFrame(momentumRef.current);
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
