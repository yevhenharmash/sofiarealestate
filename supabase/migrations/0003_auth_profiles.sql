-- Google auth via Supabase Auth: a profiles row per authenticated user,
-- auto-seeded from Google metadata on first sign-in, plus ownership on
-- listings so posting now requires auth instead of being fully public.

-- 1. Profiles table ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone_numbers TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- No SELECT policy for anyone but the owner: no other user, and no listing,
-- can read someone else's name/avatar/phone. `detail.postedBy` stays a
-- generic "Posted by owner" string. Showing the poster's name/avatar on a
-- listing later needs an explicit new policy plus a product decision.
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Auto-seed profile from Google metadata on signup ------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. Listing ownership --------------------------------------------------------
-- Nullable on purpose: pre-existing rows have no owner, and we're not
-- backfilling them. New inserts always set it (see the INSERT policy below),
-- so it's effectively NOT NULL going forward. ON DELETE SET NULL so a
-- deleted account doesn't orphan/break its listings.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS listings_user_id_idx ON listings(user_id);

-- Posting now requires auth; drop the old public-insert policy. The per-IP
-- rate-limit trigger from 0001_init.sql stays in place as defense-in-depth.
DROP POLICY IF EXISTS "Public insert" ON listings;
CREATE POLICY "Authenticated users can insert own listings" ON listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
