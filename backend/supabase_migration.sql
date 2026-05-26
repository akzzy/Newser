-- ============================================
-- Newser Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SOURCES TABLE
-- Stores news source configurations
-- ============================================
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  feed_url TEXT NOT NULL,
  website_url TEXT NOT NULL,
  logo_url TEXT,
  color TEXT DEFAULT '#000000',
  category TEXT DEFAULT 'general',
  fetch_method TEXT DEFAULT 'rss' CHECK (fetch_method IN ('rss', 'scrape')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ARTICLES TABLE
-- Stores both original and AI-rewritten articles
-- ============================================
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  original_content TEXT,
  title_hook TEXT,
  deep_dive_content TEXT,
  ai_category TEXT,
  ai_tags TEXT[] DEFAULT '{}',
  read_time TEXT,
  url TEXT UNIQUE NOT NULL,
  image_url TEXT,
  author TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  rewritten_at TIMESTAMPTZ,
  rewrite_status TEXT DEFAULT 'pending' CHECK (rewrite_status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_rewrite_status ON articles(rewrite_status);
CREATE INDEX IF NOT EXISTS idx_articles_ai_category ON articles(ai_category);
CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id);
CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- Allow public read access via anon key
-- ============================================
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read sources and articles
CREATE POLICY "Public read access for sources"
  ON sources FOR SELECT
  USING (true);

CREATE POLICY "Public read access for articles"
  ON articles FOR SELECT
  USING (true);

-- Allow insert/update/delete via anon key (for our backend)
CREATE POLICY "Allow insert for sources"
  ON sources FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update for sources"
  ON sources FOR UPDATE
  USING (true);

CREATE POLICY "Allow insert for articles"
  ON articles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update for articles"
  ON articles FOR UPDATE
  USING (true);

-- ============================================
-- SEED: Insert all 8 news sources
-- ============================================
INSERT INTO sources (name, slug, feed_url, website_url, logo_url, color, category, fetch_method, is_active) VALUES
  ('The Verge', 'the-verge', 'https://www.theverge.com/rss/index.xml', 'https://www.theverge.com', 'https://cdn.vox-cdn.com/uploads/chorus_asset/file/7395367/favicon-64x64.0.png', '#E40256', 'general', 'rss', true),
  ('Android Authority', 'android-authority', 'https://www.androidauthority.com/feed/', 'https://www.androidauthority.com', 'https://www.androidauthority.com/wp-content/uploads/2016/10/cropped-aa-logo-mark-32x32.png', '#00C853', 'mobile', 'rss', true),
  ('TechCrunch', 'techcrunch', 'https://techcrunch.com/feed/', 'https://techcrunch.com', 'https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png', '#0A9E01', 'startups', 'rss', true),
  ('Ars Technica', 'ars-technica', 'https://feeds.arstechnica.com/arstechnica/index', 'https://arstechnica.com', 'https://cdn.arstechnica.net/favicon.ico', '#FF4400', 'general', 'rss', true),
  ('Wired', 'wired', 'https://www.wired.com/feed/rss', 'https://www.wired.com', 'https://www.wired.com/verso/static/wired/assets/favicon.ico', '#000000', 'general', 'rss', true),
  ('9to5Google', '9to5google', 'https://9to5google.com/feed/', 'https://9to5google.com', 'https://9to5google.com/wp-content/uploads/sites/4/2021/07/cropped-9to5google-icon-32x32.png', '#1A73E8', 'mobile', 'rss', true),
  ('The Next Web', 'the-next-web', 'https://thenextweb.com/feed', 'https://thenextweb.com', 'https://next.tnwcdn.com/assets/img/favicon/favicon-32x32.png', '#E10000', 'general', 'rss', true),
  ('Engadget', 'engadget', 'https://www.engadget.com/rss.xml', 'https://www.engadget.com', 'https://s.blogsmithmedia.com/www.engadget.com/assets-haa26965e9e6/images/favicon-32x32.png', '#000000', 'general', 'rss', true)
ON CONFLICT (slug) DO NOTHING;
