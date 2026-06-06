import type { Metadata, Viewport } from 'next';
import OnboardingModal from '@/components/OnboardingModal';
import './globals.css';

export const metadata: Metadata = {
  title: 'Newser — AI-Powered News, Zero Noise',
  description: 'Get the signal, skip the noise. AI-rewritten news articles delivered in a premium, swipeable feed.',
  keywords: ['news', 'ai', 'tech news', 'ai rewrite', 'news aggregator'],
  openGraph: {
    title: 'Newser — AI-Powered News, Zero Noise',
    description: 'Get the signal, skip the noise. AI-rewritten news articles.',
    type: 'website'
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <OnboardingModal />
      </body>
    </html>
  );
}
