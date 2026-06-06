import { Metadata } from 'next';
import { fetchArticleById, fetchCategories, fetchSources } from '@/lib/api';
import Feed from '@/components/Feed';
import DiscoverClient from '../discover/DiscoverClient';
import ReaderDrawer from '@/components/ReaderDrawer';
import FloatingActionBar from '@/components/FloatingActionBar';
import SingleArticleClient from './SingleArticleClient';
import styles from '../page.module.css';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const article = await fetchArticleById(resolvedParams.id);
  
  if (!article) {
    return { title: 'Article Not Found | Newser' };
  }

  return {
    title: `${article.title_hook} | Newser`,
    description: article.deep_dive_content.substring(0, 160) + '...',
    openGraph: {
      title: article.title_hook,
      description: article.deep_dive_content.substring(0, 160) + '...',
      images: article.image_url ? [{ url: article.image_url }] : [],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title_hook,
      description: article.deep_dive_content.substring(0, 160) + '...',
      images: article.image_url ? [article.image_url] : [],
    }
  };
}

export default async function SharedArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const [article, categories, sources] = await Promise.all([
    fetchArticleById(resolvedParams.id),
    fetchCategories(),
    fetchSources()
  ]);
  
  if (!article) {
    return (
      <div style={{ padding: '100px 20px', color: 'white', textAlign: 'center' }}>
        <h2>Article not found</h2>
        <p>This link may have expired.</p>
      </div>
    );
  }

  const filteredCategories = categories.filter(c => c !== 'all');

  return (
    <>
      <SingleArticleClient article={article} />
      <div className={styles.desktopLayout}>
        {/* Left Pane: Discover */}
        <div className={styles.leftPane}>
          <DiscoverClient categories={filteredCategories} sources={sources} />
        </div>

        {/* Center Pane: Feed */}
        <div className={styles.centerPane} id="feed-pane">
          <FloatingActionBar />
          <Feed />
        </div>

        {/* Right Pane: Article Reader */}
        <div className={styles.rightPane}>
          <div className={styles.emptyReaderState}>
            <span className={styles.emptyReaderIcon}>📰</span>
            <h2>Ready to Read</h2>
            <p>Tap any article in the feed to read the full story here.</p>
          </div>
          <ReaderDrawer />
        </div>
      </div>
    </>
  );
}
