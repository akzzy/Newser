'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';
import type { Article } from '@/lib/api';
import PreferenceSheet, { type SheetMode } from './PreferenceSheet';
import styles from './ArticleMenu.module.css';

interface ArticleMenuProps {
  article: Article;
}

export default function ArticleMenu({ article }: ArticleMenuProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener('click', handleClickOutside), 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Track touch start to distinguish taps from swipes
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = Math.abs(e.changedTouches[0].clientX - touchStartRef.current.x);
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartRef.current.y);
    touchStartRef.current = null;

    // If finger moved more than 30px, it was a swipe — ignore it
    if (dx > 30 || dy > 30) return;

    // It was a clean tap
    e.stopPropagation();
    triggerHaptic('light');
    setIsDropdownOpen((prev) => !prev);
  }, []);

  const handleMenuClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // On touch devices, handleTouchEnd already fires — avoid double-trigger
    if ('ontouchstart' in window) return;
    triggerHaptic('light');
    setIsDropdownOpen((prev) => !prev);
  }, []);

  const handleOption = useCallback((mode: SheetMode) => {
    setIsDropdownOpen(false);
    setSheetMode(mode);
    triggerHaptic('medium');
  }, []);

  const handleSheetClose = useCallback(() => {
    setSheetMode(null);
  }, []);

  return (
    <>
      <div className={styles.menuWrapper} ref={menuRef}>
        <button
          className={styles.menuButton}
          onClick={handleMenuClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          aria-label="Article options"
        >
          <MoreVertical size={18} />
        </button>

        <div className={`${styles.dropdown} ${isDropdownOpen ? styles.dropdownOpen : ''}`}>
          <button className={styles.menuItem} onClick={(e) => { e.stopPropagation(); handleOption('block'); }}>
            Not Interested
          </button>
          <button className={styles.menuItem} onClick={(e) => { e.stopPropagation(); handleOption('boost'); }}>
            Interested
          </button>
          <button className={styles.menuItem} onClick={(e) => { e.stopPropagation(); handleOption('manage'); }}>
            Manage Preferences
          </button>
        </div>
      </div>

      {/* Render PreferenceSheet via Portal so it's outside the scroll container */}
      {typeof document !== 'undefined' && sheetMode !== null && createPortal(
        <PreferenceSheet
          isOpen={sheetMode !== null}
          mode={sheetMode || 'block'}
          article={article}
          onClose={handleSheetClose}
        />,
        document.body
      )}
    </>
  );
}
