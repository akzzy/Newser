-- ============================================
-- Newser Database Schema V2
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- DUPLICATE LOGS TABLE
-- Stores a log of all articles dropped by the deduplicator
-- ============================================
CREATE TABLE IF NOT EXISTS duplicate_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dropped_title TEXT NOT NULL,
  matched_title TEXT NOT NULL,
  method TEXT NOT NULL,
  score FLOAT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for auto-cleanup and sorting
CREATE INDEX IF NOT EXISTS idx_duplicate_logs_created_at ON duplicate_logs(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE duplicate_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for the admin dashboard)
CREATE POLICY "Public read access for duplicate_logs"
  ON duplicate_logs FOR SELECT
  USING (true);

-- Allow insert via anon key (for our backend)
CREATE POLICY "Allow insert for duplicate_logs"
  ON duplicate_logs FOR INSERT
  WITH CHECK (true);

-- Allow delete via anon key (for auto-cleanup script)
CREATE POLICY "Allow delete for duplicate_logs"
  ON duplicate_logs FOR DELETE
  USING (true);
