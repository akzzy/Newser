'use client';

import { useRouter } from 'next/navigation';
import { triggerHaptic } from '@/lib/haptics';
import { useArticleStore } from '@/store/useArticleStore';
import styles from './StackedCardGrid.module.css';

import { ArrowRight } from 'lucide-react';

export interface CardItem {
  id: string;
  title: string;
  color?: string;
  type: 'category' | 'source';
  slug?: string;
  stat?: string;
  pills?: string[];
  isDummy?: boolean;
}

interface StackedCardGridProps {
  title?: string;
  cards: CardItem[];
  variant?: 'channels' | 'topics';
  isInline?: boolean;
}

export default function StackedCardGrid({ title, cards, variant = 'channels', isInline = false }: StackedCardGridProps) {
  const router = useRouter();
  const { setCategory, setSource } = useArticleStore();

  const handleCardClick = (card: CardItem) => {
    triggerHaptic('medium');
    
    if (card.type === 'category') {
      setCategory(card.title);
    } else if (card.type === 'source' && card.slug) {
      setSource(card.slug);
    }
    
    router.push('/');
  };

  const content = (
    <>
      {!isInline && title && (
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>{title}</h1>
        </header>
      )}
      
      <div className={styles.gridContainer} style={isInline ? { padding: 0 } : undefined}>
        {cards.map((card, idx) => (
          <div 
            key={card.id} 
            className={`${variant === 'topics' ? styles.topicCard : styles.conceptCard} ${card.isDummy ? styles.dummyCard : ''}`}
            style={{ backgroundColor: card.color, zIndex: idx + 10 }}
            onClick={() => !card.isDummy && handleCardClick(card)}
          >
            {variant === 'topics' ? (
              <h2 className={styles.topicTitle}>{!card.isDummy && card.title}</h2>
            ) : (
              <>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>{card.title}</h2>
                  {card.stat && <span className={styles.cardStat}>{card.stat}</span>}
                </div>
                
                <div className={styles.cardFooter}>
                  <div className={styles.pillGroup}>
                    {card.pills?.map((pill, i) => (
                      <span key={i} className={styles.pill}>{pill}</span>
                    ))}
                  </div>
                  <div className={styles.actionButton}>
                    <ArrowRight size={20} strokeWidth={2.5} />
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );

  if (isInline) {
    return <div className={styles.inlineContainer}>{content}</div>;
  }

  return <main className={styles.scrollContainer}>{content}</main>;
}
