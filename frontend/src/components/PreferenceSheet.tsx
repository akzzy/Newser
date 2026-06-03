'use client';

import { useState, useCallback, useEffect } from 'react';
import { X, Plus, ChevronLeft } from 'lucide-react';
import { useArticleStore } from '@/store/useArticleStore';
import { triggerHaptic } from '@/lib/haptics';
import type { Article } from '@/lib/api';
import styles from './PreferenceSheet.module.css';

export type SheetMode = 'block' | 'boost' | 'manage';

interface PreferenceSheetProps {
  isOpen: boolean;
  mode: SheetMode;
  article?: Article | null;
  onClose: () => void;
}

export default function PreferenceSheet({ isOpen, mode, article, onClose }: PreferenceSheetProps) {
  const {
    blockItem, boostItem, unblockItem, unboostItem,
    blockedTags, blockedCategories, blockedSources,
    boostedTags, boostedCategories, boostedSources,
    userInterests
  } = useArticleStore();

  const [toast, setToast] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedCatForChoice, setSelectedCatForChoice] = useState<string | null>(null);

  const ALL_CATEGORIES = [
    'Technology', 'Sports', 'Gaming', 'Science', 'AI', 'Business', 
    'Entertainment', 'Finance', 'Politics', 'World', 'Health', 
    'Internet', 'Security', 'Software', 'Hardware', 'Startups', 
    'Automotive', 'Mobile'
  ];

  // Show a temporary toast notification
  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleBlockPill = useCallback((type: 'tag' | 'category' | 'source', value: string) => {
    triggerHaptic('medium');
    blockItem(type, value);
    const label = type === 'source' ? value : value;
    showToast(`You won't see "${label}" anymore`);
  }, [blockItem, showToast]);

  const handleBoostPill = useCallback((type: 'tag' | 'category' | 'source', value: string) => {
    triggerHaptic('medium');
    boostItem(type, value);
    showToast(`You'll see more "${value}"`);
  }, [boostItem, showToast]);

  // Gather all blocked/boosted items for manage mode
  const allBlocked = [
    ...blockedTags.map(v => ({ type: 'tag' as const, value: v })),
    ...blockedCategories.map(v => ({ type: 'category' as const, value: v })),
    ...blockedSources.map(v => ({ type: 'source' as const, value: v })),
  ];

  const allBoosted = [
    ...boostedTags.map(v => ({ type: 'tag' as const, value: v })),
    ...boostedCategories.map(v => ({ type: 'category' as const, value: v })),
    ...boostedSources.map(v => ({ type: 'source' as const, value: v })),
  ];

  const title = mode === 'block' ? 'Not Interested' : mode === 'boost' ? 'Interested' : isPickerOpen ? '' : 'Manage Preferences';

  return (
    <>
      {/* Overlay */}
      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayVisible : ''}`}
        onClick={(e) => { e.stopPropagation(); onClose(); setIsPickerOpen(false); setSelectedCatForChoice(null); }}
        onTouchEnd={(e) => e.stopPropagation()}
      />

      {/* Sheet */}
      <div
        className={`${styles.sheet} ${isOpen ? styles.sheetOpen : ''}`}
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div className={styles.dragHandle}>
          <div className={styles.dragBar} />
        </div>

        <div className={styles.sheetHeader}>
          {mode === 'manage' && isPickerOpen ? (
            <div className={styles.pickerHeader}>
              <button className={styles.backBtn} onClick={() => setIsPickerOpen(false)}>
                <ChevronLeft size={20} />
              </button>
              <span className={styles.pickerTitle}>Add Topic</span>
            </div>
          ) : (
            <>
              <span className={styles.sheetTitle}>{title}</span>
              <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </>
          )}
        </div>

        <div className={styles.sheetContent}>
          {/* ── Block / Boost mode ── */}
          {(mode === 'block' || mode === 'boost') && article && (
            <>
              {/* AI Tags */}
              {article.ai_tags && article.ai_tags.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>Topics</div>
                  <div className={styles.pillGrid}>
                    {article.ai_tags.map((tag) => {
                      const isAlready = mode === 'block'
                        ? blockedTags.includes(tag)
                        : boostedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          className={`${styles.pill} ${
                            mode === 'block'
                              ? isAlready ? styles.pillBlockActive : styles.pillBlock
                              : isAlready ? styles.pillBoostActive : styles.pillBoost
                          }`}
                          onClick={() =>
                            mode === 'block'
                              ? handleBlockPill('tag', tag)
                              : handleBoostPill('tag', tag)
                          }
                          disabled={isAlready}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category */}
              {article.ai_category && (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>Category</div>
                  <div className={styles.pillGrid}>
                    {(() => {
                      const isAlready = mode === 'block'
                        ? blockedCategories.includes(article.ai_category)
                        : boostedCategories.includes(article.ai_category);
                      return (
                        <button
                          className={`${styles.pill} ${
                            mode === 'block'
                              ? isAlready ? styles.pillBlockActive : styles.pillBlock
                              : isAlready ? styles.pillBoostActive : styles.pillBoost
                          }`}
                          onClick={() =>
                            mode === 'block'
                              ? handleBlockPill('category', article.ai_category)
                              : handleBoostPill('category', article.ai_category)
                          }
                          disabled={isAlready}
                        >
                          {article.ai_category}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Source */}
              {article.source && (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>Source</div>
                  <div className={styles.pillGrid}>
                    {(() => {
                      const isAlready = mode === 'block'
                        ? blockedSources.includes(article.source!.slug)
                        : boostedSources.includes(article.source!.slug);
                      return (
                        <button
                          className={`${styles.pill} ${
                            mode === 'block'
                              ? isAlready ? styles.pillBlockActive : styles.pillBlock
                              : isAlready ? styles.pillBoostActive : styles.pillBoost
                          }`}
                          onClick={() =>
                            mode === 'block'
                              ? handleBlockPill('source', article.source!.slug)
                              : handleBoostPill('source', article.source!.slug)
                          }
                          disabled={isAlready}
                        >
                          {article.source!.name}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Manage mode ── */}
          {mode === 'manage' && !isPickerOpen && (
            <>
              {/* My Interests (From Onboarding) */}
              {userInterests && userInterests.length > 0 && (
                <div className={styles.manageGroup}>
                  <div className={`${styles.manageGroupTitle} ${styles.manageGroupTitleInterests}`}>
                    🎯 My Interests
                  </div>
                  {userInterests.map((interest) => (
                    <div key={`interest-${interest}`} className={styles.manageItem}>
                      <div>
                        <span className={styles.manageItemLabel}>{interest}</span>
                      </div>
                      {/* No remove button for core interests yet, as it requires API update */}
                    </div>
                  ))}
                </div>
              )}

              {/* Boosted items */}
              <div className={styles.manageGroup}>
                <div className={`${styles.manageGroupTitle} ${styles.manageGroupTitleBoost}`}>
                  Boosted
                </div>
                {allBoosted.length === 0 ? (
                  <div className={styles.emptyState}>No boosted topics yet</div>
                ) : (
                  allBoosted.map(({ type, value }) => (
                    <div key={`boost-${type}-${value}`} className={styles.manageItem}>
                      <div>
                        <span className={styles.manageItemLabel}>{value}</span>
                        <span className={styles.manageItemType}>{type}</span>
                      </div>
                      <button
                        className={styles.removeBtn}
                        onClick={() => {
                          triggerHaptic('light');
                          unboostItem(type, value);
                          showToast(`Removed boost for "${value}"`);
                        }}
                        aria-label={`Remove boost for ${value}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Blocked items */}
              <div className={styles.manageGroup}>
                <div className={`${styles.manageGroupTitle} ${styles.manageGroupTitleBlock}`}>
                  Blocked
                </div>
                {allBlocked.length === 0 ? (
                  <div className={styles.emptyState}>No blocked topics yet</div>
                ) : (
                  allBlocked.map(({ type, value }) => (
                    <div key={`block-${type}-${value}`} className={styles.manageItem}>
                      <div>
                        <span className={styles.manageItemLabel}>{value}</span>
                        <span className={styles.manageItemType}>{type}</span>
                      </div>
                      <button
                        className={styles.removeBtn}
                        onClick={() => {
                          triggerHaptic('light');
                          unblockItem(type, value);
                          showToast(`Unblocked "${value}"`);
                        }}
                        aria-label={`Unblock ${value}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button className={styles.addCategoryBtn} onClick={() => setIsPickerOpen(true)}>
                <Plus size={16} /> Add Topic
              </button>
            </>
          )}

          {/* ── Add Category Picker ── */}
          {mode === 'manage' && isPickerOpen && (
            <div className={styles.pickerGrid}>
              {ALL_CATEGORIES.map(cat => (
                <div 
                  key={cat} 
                  className={styles.pickerPill}
                  onClick={() => setSelectedCatForChoice(cat)}
                >
                  {cat}
                </div>
              ))}
            </div>
          )}

          {/* Modal for Boost/Block choice inside the picker */}
          <div className={`${styles.choiceModalOverlay} ${selectedCatForChoice ? styles.choiceModalVisible : ''}`}>
            <div className={styles.choiceModal}>
              <div className={styles.choiceTitle}>{selectedCatForChoice}</div>
              <button 
                className={`${styles.choiceBtn} ${styles.choiceBtnBoost}`}
                onClick={() => {
                  triggerHaptic('medium');
                  boostItem('category', selectedCatForChoice!);
                  showToast(`Boosted "${selectedCatForChoice}"`);
                  setSelectedCatForChoice(null);
                  setIsPickerOpen(false);
                }}
              >
                Boost this topic
              </button>
              <button 
                className={`${styles.choiceBtn} ${styles.choiceBtnBlock}`}
                onClick={() => {
                  triggerHaptic('medium');
                  blockItem('category', selectedCatForChoice!);
                  showToast(`Blocked "${selectedCatForChoice}"`);
                  setSelectedCatForChoice(null);
                  setIsPickerOpen(false);
                }}
              >
                Block this topic
              </button>
              <button 
                className={`${styles.choiceBtn} ${styles.choiceBtnCancel}`}
                onClick={() => setSelectedCatForChoice(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      <div className={`${styles.toast} ${toast ? styles.toastVisible : ''}`}>
        {toast}
      </div>
    </>
  );
}
