-- Bulgarian Real Estate Map App — initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

-- 1. PostGIS ---------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Listings table ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,          -- stored in EUR (BG adopted the euro Jan 2026)
  type TEXT NOT NULL CHECK (type IN ('room', 'flat', 'house')),
  phone TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index — required, the bounding-box query below full-scans without it
CREATE INDEX IF NOT EXISTS listings_location_gix ON listings USING GIST (location);

-- 3. Spatial bounding-box search function (capped to avoid huge payloads when zoomed out)
CREATE OR REPLACE FUNCTION get_listings_in_bounds(
  min_lng float, min_lat float, max_lng float, max_lat float,
  max_price numeric DEFAULT NULL,
  listing_type text DEFAULT NULL,
  row_limit int DEFAULT 500
)
RETURNS TABLE (
  id uuid, title text, description text, price numeric,
  type text, phone text, lat float, lng float, images text[]
)
LANGUAGE sql STABLE AS $$
  SELECT
    id, title, description, price, type, phone,
    ST_Y(location::geometry) as lat,
    ST_X(location::geometry) as lng,
    images
  FROM listings
  WHERE location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    AND (max_price IS NULL OR price <= max_price)
    AND (listing_type IS NULL OR type = listing_type)
  LIMIT row_limit;
$$;

-- 4. Row Level Security — anon key is public, so this is not optional -------
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON listings
  FOR SELECT USING (true);

CREATE POLICY "Public insert" ON listings
  FOR INSERT WITH CHECK (true); -- see anti-abuse trigger below

-- 5. Anti-abuse: simple per-IP rate limit on inserts -------------------------
-- Not bulletproof (IP can be spoofed/shared), but stops naive spam bots for
-- the POC. Revisit with real auth (magic link / phone OTP) before launch.
CREATE TABLE IF NOT EXISTS listing_insert_log (
  ip TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION enforce_listing_insert_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  client_ip TEXT;
  recent_count INT;
BEGIN
  -- PostgREST forwards the caller's IP in the request headers; falls back to
  -- 'unknown' when run outside PostgREST (e.g. SQL editor), which just shares
  -- one bucket for manual testing.
  client_ip := COALESCE(
    (current_setting('request.headers', true)::json->>'x-forwarded-for'),
    'unknown'
  );

  SELECT COUNT(*) INTO recent_count
  FROM listing_insert_log
  WHERE ip = client_ip
    AND created_at > NOW() - INTERVAL '1 hour';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many listings posted recently. Try again later.';
  END IF;

  INSERT INTO listing_insert_log (ip) VALUES (client_ip);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS listings_rate_limit ON listings;
CREATE TRIGGER listings_rate_limit
  BEFORE INSERT ON listings
  FOR EACH ROW EXECUTE FUNCTION enforce_listing_insert_rate_limit();

-- Housekeeping: keep the log table small.
CREATE OR REPLACE FUNCTION prune_listing_insert_log()
RETURNS void AS $$
  DELETE FROM listing_insert_log WHERE created_at < NOW() - INTERVAL '1 day';
$$ LANGUAGE sql;

-- 6. Storage bucket for listing photos --------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('listing-photos', 'listing-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Public read, public insert, no update/delete from anon.
CREATE POLICY "Public read listing photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'listing-photos');

CREATE POLICY "Public upload listing photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'listing-photos');
