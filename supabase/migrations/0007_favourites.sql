-- Favourites: users can save listings to a personal list. Simple join table
-- between auth.users and listings, owner-only via RLS (mirrors the owner
-- policies added in 0004_listing_status.sql).

CREATE TABLE IF NOT EXISTS favourites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, listing_id)
);

ALTER TABLE favourites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read own favourites" ON favourites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Owners can add own favourites" ON favourites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can remove own favourites" ON favourites
  FOR DELETE USING (auth.uid() = user_id);

-- Favourites list lookup, same ST_X/ST_Y flattening pattern as
-- get_my_listings / get_listings_in_bounds. Only active listings are
-- returned — if a favourited listing is later set to draft/expired (or
-- deleted, via the FK cascade), it silently drops out of the list.
CREATE OR REPLACE FUNCTION get_my_favourites()
RETURNS TABLE (
  id uuid, title text, description text, price numeric,
  type text, phone text, lat float, lng float, images text[],
  "createdAt" timestamptz
)
LANGUAGE sql STABLE AS $$
  SELECT
    l.id, l.title, l.description, l.price, l.type, l.phone,
    ST_Y(l.location::geometry) as lat,
    ST_X(l.location::geometry) as lng,
    l.images, l.created_at as "createdAt"
  FROM favourites f
  JOIN listings l ON l.id = f.listing_id
  WHERE f.user_id = auth.uid() AND l.status = 'active'
  ORDER BY f.created_at DESC;
$$;
