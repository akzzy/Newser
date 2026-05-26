-- Fix for mobile browsers where crypto.randomUUID() is not available

-- We need to change the ID columns from 'uuid' to 'text' because mobile
-- browsers over HTTP (local network testing) generate 'guest_xyz123' strings.

-- 1. Drop the foreign key constraint temporarily
ALTER TABLE public.guest_preferences DROP CONSTRAINT IF EXISTS guest_preferences_guest_id_fkey;

-- 2. Alter the column types to text
ALTER TABLE public.guest_profiles ALTER COLUMN id TYPE text;
ALTER TABLE public.guest_preferences ALTER COLUMN guest_id TYPE text;

-- 3. Re-add the foreign key constraint
ALTER TABLE public.guest_preferences 
  ADD CONSTRAINT guest_preferences_guest_id_fkey 
  FOREIGN KEY (guest_id) 
  REFERENCES public.guest_profiles(id) 
  ON DELETE CASCADE;
