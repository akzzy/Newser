'use client';

import { useRouter } from 'next/navigation';
import { useArticleStore } from '@/store/useArticleStore';
import { triggerHaptic } from '@/lib/haptics';
import StackedCardGrid, { CardItem } from '@/components/StackedCardGrid';
import { 
  Flame, Star, Clock, Sparkles, Globe, Briefcase, 
  Cpu, Gamepad2, Film, Trophy, Landmark, Hash, 
  Microscope, Palette, HeartPulse, Music, Car, Utensils 
} from 'lucide-react';
import styles from './DiscoverBento.module.css';

// Helper to get an icon for a category
const getCategoryIcon = (cat: string) => {
  const normalized = cat.toLowerCase();
  const props = { size: 16, strokeWidth: 1.5 };
  if (normalized.includes('tech')) return <Cpu {...props} />;
  if (normalized.includes('science')) return <Microscope {...props} />;
  if (normalized.includes('health') || normalized.includes('medic')) return <HeartPulse {...props} />;
  if (normalized.includes('culture') || normalized.includes('art')) return <Palette {...props} />;
  if (normalized.includes('music')) return <Music {...props} />;
  if (normalized.includes('auto') || normalized.includes('car')) return <Car {...props} />;
  if (normalized.includes('food') || normalized.includes('dining')) return <Utensils {...props} />;
  if (normalized.includes('world') || normalized.includes('foryou') || normalized === 'all') return <Globe {...props} />;
  if (normalized.includes('business') || normalized.includes('finance')) return <Briefcase {...props} />;
  if (normalized.includes('game') || normalized.includes('gaming')) return <Gamepad2 {...props} />;
  if (normalized.includes('entertain') || normalized.includes('movie')) return <Film {...props} />;
  if (normalized.includes('sport')) return <Trophy {...props} />;
  if (normalized.includes('politic')) return <Landmark {...props} />;
  return <Hash {...props} />;
};

export default function DiscoverClient({ categories, sources }: { categories: string[], sources: any[] }) {
  const router = useRouter();
  const { setCategory, setSource, setSort, hasCompletedOnboarding } = useArticleStore();

  const handleQuickAction = (action: string) => {
    triggerHaptic('medium');
    
    if (action === 'foryou') {
      setSort('foryou');
    } else if (action === 'trending') {
      setSort('trending');
    } else if (action === 'top') {
      setSort('top_today');
    } else if (action === 'latest') {
      setSort('latest');
    }
    
    router.push('/');
  };

  const handleSourceClick = (src: string) => {
    triggerHaptic('medium');
    setSource(src);
    router.push('/');
  };

  const handleTopicClick = (cat: string) => {
    triggerHaptic('medium');
    setCategory(cat);
    router.push('/');
  };

  // No duplication needed, just use the raw categories from the backend
  const bentoCategories = [...categories];

  // Abstract gradients for the premium bento backgrounds
  const abstractGradients = [
    'linear-gradient(135deg, #1f005c, #5b0060)', // Deep purple
    'linear-gradient(135deg, #870000, #190a05)', // Blood red
    'linear-gradient(135deg, #004e92, #000428)', // Deep sea blue
    'linear-gradient(135deg, #0f2027, #203a43)', // Teal slate
    'linear-gradient(135deg, #e65c00, #d38312)', // Sunset dark
    'linear-gradient(135deg, #3a1c71, #d76d77)', // Soft dusk
  ];

  return (
    <div className={styles.container}>
      
      {/* Fixed header */}
      <header className={styles.header}>
        <h1 className={styles.title}>DISCOVER</h1>
      </header>

      {/* 1. Quick Actions (Grid) */}
      <div className={styles.quickActionsGrid}>
        {hasCompletedOnboarding && (
          <div className={styles.actionCard} onClick={() => handleQuickAction('foryou')}>
            <Sparkles size={18} className={styles.actionIcon} />
            <span>For You</span>
          </div>
        )}
        <div className={styles.actionCard} onClick={() => handleQuickAction('trending')}>
          <Flame size={18} className={styles.actionIcon} />
          <span>Trending</span>
        </div>
        <div className={styles.actionCard} onClick={() => handleQuickAction('top')}>
          <Star size={18} className={styles.actionIcon} />
          <span>Top Today</span>
        </div>
        <div className={styles.actionCard} onClick={() => handleQuickAction('latest')}>
          <Clock size={18} className={styles.actionIcon} />
          <span>Latest News</span>
        </div>
      </div>

      {/* 2. Publishers Row (Large Icons) */}
      <div className={styles.channelsSection}>
        <div className={styles.channelsScroll}>
          {sources.map((src) => (
            <div className={styles.channelBadge} key={src.id} onClick={() => handleSourceClick(src.slug)}>
              <img 
                src={src.logo_url} 
                alt={src.name} 
                className={styles.channelLogoLarge}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(src.name)}&background=1a1a1a&color=fff&size=128`;
                }}
              />
              <span className={styles.channelNameSmall}>{src.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Topics Abstract Bento Grid */}
      <div className={styles.topicsSection}>
        <h2 className={styles.sectionTitle}>Explore Topics</h2>
        
        <div className={styles.topicsScroll}>
          <div className={styles.bentoTopicsGrid}>
            {bentoCategories.map((cat, i) => {
              if (cat === 'all' && !hasCompletedOnboarding) return null;
              
              return (
                <div 
                  key={`${cat}-${i}`} 
                  className={styles.topicCard}
                  onClick={() => handleTopicClick(cat)}
                >
                  <div className={styles.topicIconWrapper}>
                    {getCategoryIcon(cat === 'all' ? 'foryou' : cat)}
                  </div>
                  <span className={styles.topicTitle}>{cat === 'all' ? 'For You' : cat}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Bottom Vignette for Nav Bar */}
      <div className={styles.vignetteBottom}></div>

    </div>
  );
}
