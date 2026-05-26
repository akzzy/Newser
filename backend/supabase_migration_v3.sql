-- ============================================
-- Newser Database Schema V3 (Fix for Deletes)
-- Run this in Supabase SQL Editor
-- ============================================

-- Allow delete via anon key (for the admin dashboard)
CREATE POLICY "Allow delete for articles"
  ON articles FOR DELETE
  USING (true);
