'use client';

import { useState, useEffect } from 'react';
import { useArticleStore } from '@/store/useArticleStore';
import { triggerHaptic } from '@/lib/haptics';
import { fetchCategories } from '@/lib/api';
import styles from './OnboardingModal.module.css';

export default function OnboardingModal() {
  const { showOnboardingPopup, completeOnboarding } = useArticleStore();
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (showOnboardingPopup && categories.length === 0) {
      // Fetch dynamic categories that actually exist in the DB
      fetchCategories().then(data => {
        // Remove the generic 'all' category that the API prepends
        const filtered = data.filter(cat => cat !== 'all');
        setCategories(filtered);
      }).catch(console.error);
    }
  }, [showOnboardingPopup, categories.length]);

  if (!showOnboardingPopup) return null;

  const toggleCategory = (cat: string) => {
    triggerHaptic('light');
    const next = new Set(selected);
    if (next.has(cat)) {
      next.delete(cat);
    } else {
      next.add(cat);
    }
    setSelected(next);
  };

  const handleSubmit = async () => {
    if (selected.size === 0) return;
    
    triggerHaptic('success');
    setIsSubmitting(true);
    
    // Convert to lowercase to match backend AI categories if needed, or leave as is.
    // The backend uses ilike, so case doesn't matter too much, but let's keep it clean.
    const categoriesArray = Array.from(selected);
    
    await completeOnboarding(categoriesArray);
    setIsSubmitting(false);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <h1 className={styles.title}>What do you want to read about?</h1>
        <p className={styles.subtitle}>Pick 1 or more topics to build your For You feed.</p>
      </div>

      <div className={styles.grid}>
        {categories.map(cat => (
          <button
            key={cat}
            className={`${styles.pill} ${selected.has(cat) ? styles.selected : ''}`}
            onClick={() => toggleCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className={styles.footer}>
        <button 
          className={styles.button}
          disabled={selected.size < 1 || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? 'Building Feed...' : 'Start Reading'}
        </button>
      </div>
    </div>
  );
}
