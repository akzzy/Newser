-- Migration V6: Dashboard V2 Scraper Tracking

-- Add is_scraped flag to track if the background bot had to visit the website to extract full content.
-- Default is false (meaning it got enough content purely from the RSS feed).
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS is_scraped BOOLEAN DEFAULT false;

-- Create an index to speed up dashboard metrics querying
CREATE INDEX IF NOT EXISTS idx_articles_is_scraped ON public.articles(is_scraped);
CREATE INDEX IF NOT EXISTS idx_articles_rewrite_status ON public.articles(rewrite_status);
