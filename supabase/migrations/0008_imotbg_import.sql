-- Import pipeline for imot.bg rental listings: scraped rows land in the same
-- `listings` table as user posts, distinguished by `source`. Backfills the
-- map with real Sofia listings from day one. See
-- .cursor/plans/imotbg-import.plan.md for the full design.

-- 1. New columns on listings --------------------------------------------------
ALTER TABLE listings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user'
  CHECK (source IN ('user', 'imotbg'));
ALTER TABLE listings ADD COLUMN IF NOT EXISTS source_url TEXT UNIQUE;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS location_precision TEXT NOT NULL DEFAULT 'exact'
  CHECK (location_precision IN ('exact', 'approximate'));
ALTER TABLE listings ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- 2. Status filter gap: `status` (0004_listing_status.sql) was never enforced
-- in the public read RPCs, so expiring a listing had no visible effect.
-- Picks up the new source/sourceUrl/locationPrecision columns in the same
-- pass since the row shape is changing anyway -- DROP is required, same
-- reasoning as the get_listings_in_bounds recreate in 0002.
DROP FUNCTION IF EXISTS get_listings_in_bounds(float, float, float, float, numeric, text, int);

CREATE OR REPLACE FUNCTION get_listings_in_bounds(
  min_lng float, min_lat float, max_lng float, max_lat float,
  max_price numeric DEFAULT NULL,
  listing_type text DEFAULT NULL,
  row_limit int DEFAULT 500
)
RETURNS TABLE (
  id uuid, title text, description text, price numeric,
  type text, phone text, lat float, lng float, images text[],
  "createdAt" timestamptz, source text, "sourceUrl" text,
  "locationPrecision" text
)
LANGUAGE sql STABLE AS $$
  SELECT
    id, title, description, price, type, phone,
    ST_Y(location::geometry) as lat,
    ST_X(location::geometry) as lng,
    images, created_at as "createdAt", source, source_url as "sourceUrl",
    location_precision as "locationPrecision"
  FROM listings
  WHERE location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    AND status = 'active'
    AND (max_price IS NULL OR price <= max_price)
    AND (listing_type IS NULL OR type = listing_type)
  LIMIT row_limit;
$$;

DROP FUNCTION IF EXISTS get_listing_by_id(uuid);

CREATE OR REPLACE FUNCTION get_listing_by_id(listing_id uuid)
RETURNS TABLE (
  id uuid, title text, description text, price numeric,
  type text, phone text, lat float, lng float, images text[],
  "createdAt" timestamptz, source text, "sourceUrl" text,
  "locationPrecision" text
)
LANGUAGE sql STABLE AS $$
  SELECT
    id, title, description, price, type, phone,
    ST_Y(location::geometry) as lat,
    ST_X(location::geometry) as lng,
    images, created_at as "createdAt", source, source_url as "sourceUrl",
    location_precision as "locationPrecision"
  FROM listings
  WHERE id = listing_id AND status = 'active';
$$;

-- get_my_favourites (0007_favourites.sql) renders through the same
-- ListingCard as the map/detail pages, so it needs the same three columns to
-- show imotbg attribution for a favourited scraped listing. Already filters
-- status = 'active', so no change needed there.
DROP FUNCTION IF EXISTS get_my_favourites();

CREATE OR REPLACE FUNCTION get_my_favourites()
RETURNS TABLE (
  id uuid, title text, description text, price numeric,
  type text, phone text, lat float, lng float, images text[],
  "createdAt" timestamptz, source text, "sourceUrl" text,
  "locationPrecision" text
)
LANGUAGE sql STABLE AS $$
  SELECT
    l.id, l.title, l.description, l.price, l.type, l.phone,
    ST_Y(l.location::geometry) as lat,
    ST_X(l.location::geometry) as lng,
    l.images, l.created_at as "createdAt", l.source, l.source_url as "sourceUrl",
    l.location_precision as "locationPrecision"
  FROM favourites f
  JOIN listings l ON l.id = f.listing_id
  WHERE f.user_id = auth.uid() AND l.status = 'active'
  ORDER BY f.created_at DESC;
$$;

-- 3. upsert_scraped_listing: the single write path for the importer, mirroring
-- the SECURITY DEFINER pattern already used elsewhere (handle_new_user,
-- enforce_listing_insert_rate_limit). Always forces user_id = NULL and
-- source = 'imotbg' so a caller can't use this to plant a listing that looks
-- owner-editable. Locked down to service_role below (section 7) since it's
-- only ever meant to be called from the scraper.
CREATE OR REPLACE FUNCTION upsert_scraped_listing(
  p_source_url text,
  p_title text,
  p_description text,
  p_price numeric,
  p_type text,
  p_phone text,
  p_images text[],
  p_lat float,
  p_lng float,
  p_location_precision text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result_id uuid;
BEGIN
  INSERT INTO listings (
    title, description, price, type, phone, images, location,
    user_id, source, source_url, location_precision, status, last_seen_at
  )
  VALUES (
    p_title, p_description, p_price, p_type, p_phone, p_images,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    NULL, 'imotbg', p_source_url, p_location_precision, 'active', NOW()
  )
  ON CONFLICT (source_url) DO UPDATE SET
    price = EXCLUDED.price,
    -- A refresh pass (existing source_url, list page only) has no detail-page
    -- data to offer and passes NULL/'{}' here -- COALESCE keeps the
    -- previously-fetched description/images instead of wiping them out.
    description = COALESCE(EXCLUDED.description, listings.description),
    images = CASE
      WHEN array_length(EXCLUDED.images, 1) IS NULL THEN listings.images
      ELSE EXCLUDED.images
    END,
    last_seen_at = NOW(),
    status = 'active'
  RETURNING id INTO result_id;

  RETURN result_id;
END;
$$;

-- 4. Expire listings the crawler hasn't seen in a while -- imot.bg gives no
-- "removed" signal, so absence-from-recent-crawl is the only removal signal
-- we get. Called at the end of each full crawl cycle (pagination wraparound).
CREATE OR REPLACE FUNCTION expire_stale_imotbg_listings(cutoff INTERVAL DEFAULT '2 days')
RETURNS void
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE listings
  SET status = 'expired'
  WHERE source = 'imotbg' AND status = 'active' AND last_seen_at < NOW() - cutoff;
$$;

-- 5. service-role bypass: this trigger (0001_init.sql) fires on every insert
-- regardless of caller, so without this the importer would get capped at the
-- anon per-IP limit (5/hour) like everyone else.
CREATE OR REPLACE FUNCTION enforce_listing_insert_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  client_ip TEXT;
  recent_count INT;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

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

-- 6. Scrape cursor: lets each invocation pick up list-page pagination where
-- the last one left off instead of restarting from page 1 every run.
CREATE TABLE IF NOT EXISTS imotbg_scrape_state (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  next_page INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO imotbg_scrape_state (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE imotbg_scrape_state ENABLE ROW LEVEL SECURITY;
-- No policies: service_role bypasses RLS; nobody else needs access to it.

-- 7. Restrict the write RPCs to the importer. Both are SECURITY DEFINER, so
-- without this an anon/authenticated caller could invoke them directly and
-- insert/expire rows outside the normal auth + RLS path.
REVOKE EXECUTE ON FUNCTION upsert_scraped_listing(text, text, text, numeric, text, text, text[], float, float, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_scraped_listing(text, text, text, numeric, text, text, text[], float, float, text) TO service_role;

REVOKE EXECUTE ON FUNCTION expire_stale_imotbg_listings(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION expire_stale_imotbg_listings(interval) TO service_role;
