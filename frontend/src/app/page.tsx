import { fetchCategories, fetchSources } from '@/lib/api';
import Feed from '@/components/Feed';
import DiscoverClient from './discover/DiscoverClient';
import ReaderDrawer from '@/components/ReaderDrawer';
import styles from './page.module.css';

export const revalidate = 0;

export default async function HomePage() {
  // Fetch data for the Discover pane
  const [categories, sources] = await Promise.all([
    fetchCategories(),
    fetchSources()
  ]);

  const filteredCategories = categories.filter(c => c !== 'all');

  return (
    <div className={styles.desktopLayout}>
      {/* Left Pane: Discover */}
      <div className={styles.leftPane}>
        <DiscoverClient categories={filteredCategories} sources={sources} />
      </div>

      {/* Center Pane: Feed */}
      <div className={styles.centerPane}>
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
  );
}
