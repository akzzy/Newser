-- Migration V7: Add Importance Score for Top/Trending
-- Importance Score starts at 1. Gets incremented when a duplicate is found by the deduplicator.

ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS importance_score INTEGER DEFAULT 1;

-- Index for fast sorting by importance
CREATE INDEX IF NOT EXISTS idx_articles_importance_score ON public.articles(importance_score DESC);
