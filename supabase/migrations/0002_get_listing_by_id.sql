-- Single-listing lookup RPC for the detail page (/listing/:id), same
-- ST_X/ST_Y flattening pattern as get_listings_in_bounds. Also backfills
-- created_at into both RPCs' return shape so cards/detail page can show
-- relative posted-time without a second query.

CREATE OR REPLACE FUNCTION get_listing_by_id(listing_id uuid)
RETURNS TABLE (
  id uuid, title text, description text, price numeric,
  type text, phone text, lat float, lng float, images text[],
  "createdAt" timestamptz
)
LANGUAGE sql STABLE AS $$
  SELECT
    id, title, description, price, type, phone,
    ST_Y(location::geometry) as lat,
    ST_X(location::geometry) as lng,
    images, created_at as "createdAt"
  FROM listings
  WHERE id = listing_id;
$$;

-- Re-create get_listings_in_bounds to add created_at to its output too,
-- keeping both RPCs' shapes consistent for the shared `Listing` type.
-- Dropped first: CREATE OR REPLACE can't change a function's return-row shape.
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
  "createdAt" timestamptz
)
LANGUAGE sql STABLE AS $$
  SELECT
    id, title, description, price, type, phone,
    ST_Y(location::geometry) as lat,
    ST_X(location::geometry) as lng,
    images, created_at as "createdAt"
  FROM listings
  WHERE location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    AND (max_price IS NULL OR price <= max_price)
    AND (listing_type IS NULL OR type = listing_type)
  LIMIT row_limit;
$$;
