import { fetchCategories, fetchSources } from '@/lib/api';
import DiscoverClient from './DiscoverClient';

export const revalidate = 0; // Force refresh to load new logos

export default async function DiscoverPage() {
  const [categories, sources] = await Promise.all([
    fetchCategories(),
    fetchSources()
  ]);

  // Remove the redundant 'all' category from the bento grid
  const filteredCategories = categories.filter(c => c !== 'all');

  return <DiscoverClient categories={filteredCategories} sources={sources} />;
}
