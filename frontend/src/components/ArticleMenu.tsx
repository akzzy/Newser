'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
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

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    // Use a small delay so the click that opened the menu doesn't immediately close it
    const timer = setTimeout(() => document.addEventListener('click', handleClickOutside), 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleMenuClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger article card click
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
          aria-label="Article options"
        >
          <MoreVertical size={18} />
        </button>

        <div className={`${styles.dropdown} ${isDropdownOpen ? styles.dropdownOpen : ''}`}>
          <button className={styles.menuItem} onClick={() => handleOption('block')}>
            <span className={`${styles.menuItemIcon} ${styles.menuItemBlock}`}>🚫</span>
            Not Interested
          </button>
          <button className={styles.menuItem} onClick={() => handleOption('boost')}>
            <span className={`${styles.menuItemIcon} ${styles.menuItemBoost}`}>❤️</span>
            More Like This
          </button>
          <button className={styles.menuItem} onClick={() => handleOption('manage')}>
            <span className={`${styles.menuItemIcon} ${styles.menuItemManage}`}>⚙️</span>
            Manage Preferences
          </button>
        </div>
      </div>

      <PreferenceSheet
        isOpen={sheetMode !== null}
        mode={sheetMode || 'block'}
        article={article}
        onClose={handleSheetClose}
      />
    </>
  );
}
