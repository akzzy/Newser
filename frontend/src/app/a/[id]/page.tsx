import { Metadata } from 'next';
import { fetchArticleById } from '@/lib/api';
import Feed from '@/components/Feed';
import SingleArticleClient from './SingleArticleClient';

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
  const article = await fetchArticleById(resolvedParams.id);
  
  if (!article) {
    return (
      <div style={{ padding: '100px 20px', color: 'white', textAlign: 'center' }}>
        <h2>Article not found</h2>
        <p>This link may have expired.</p>
      </div>
    );
  }

  return (
    <>
      <SingleArticleClient article={article} />
      <Feed />
    </>
  );
}
