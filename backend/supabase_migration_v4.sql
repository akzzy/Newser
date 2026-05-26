-- Migration V4: Ghost Account Personalization System

-- 1. Create guest profiles table
CREATE TABLE IF NOT EXISTS public.guest_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  last_active timestamptz DEFAULT now()
);

-- 2. Create guest preferences table
-- Tracks how much a specific guest likes a specific category
CREATE TABLE IF NOT EXISTS public.guest_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES public.guest_profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  score integer DEFAULT 1,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(guest_id, category) -- Ensure one row per guest per category
);

-- 3. Set up Row Level Security (RLS)
ALTER TABLE public.guest_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_preferences ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for the backend API
CREATE POLICY "Allow public read guest_profiles" ON public.guest_profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert guest_profiles" ON public.guest_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update guest_profiles" ON public.guest_profiles FOR UPDATE USING (true);

CREATE POLICY "Allow public read guest_preferences" ON public.guest_preferences FOR SELECT USING (true);
CREATE POLICY "Allow public insert guest_preferences" ON public.guest_preferences FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update guest_preferences" ON public.guest_preferences FOR UPDATE USING (true);

-- 4. Create an index on guest_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_guest_preferences_guest_id ON public.guest_preferences(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_preferences_score ON public.guest_preferences(score DESC);
