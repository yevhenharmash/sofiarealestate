-- My Listings page: owners need to see/edit/delete their own listings and
-- track a lifecycle status. Neither existed before — RLS had no UPDATE or
-- DELETE policy at all, so both were silently blocked.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'draft', 'expired'));

CREATE POLICY "Owners can update own listings" ON listings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can delete own listings" ON listings
  FOR DELETE USING (auth.uid() = user_id);

-- Owner listing lookup for the My Listings page, same ST_X/ST_Y flattening
-- pattern as get_listings_in_bounds / get_listing_by_id.
CREATE OR REPLACE FUNCTION get_my_listings()
RETURNS TABLE (
  id uuid, title text, description text, price numeric,
  type text, phone text, lat float, lng float, images text[],
  status text, "createdAt" timestamptz
)
LANGUAGE sql STABLE AS $$
  SELECT
    id, title, description, price, type, phone,
    ST_Y(location::geometry) as lat,
    ST_X(location::geometry) as lng,
    images, status, created_at as "createdAt"
  FROM listings
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC;
$$;
