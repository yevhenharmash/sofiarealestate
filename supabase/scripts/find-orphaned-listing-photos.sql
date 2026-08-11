-- Manual, one-off maintenance query — run in the Supabase SQL editor.
-- Not automated on a schedule; run it whenever you suspect storage has
-- drifted from the `listings` table (e.g. before the 0005 RLS fix, every
-- "removed" photo left its object behind).
--
-- Lists listing-photos objects that no listing's `images[]` currently
-- references.
--
-- IMPORTANT: deleting rows from storage.objects with plain SQL only removes
-- the metadata row, NOT the underlying file blob — it would make the file
-- unmanageable instead of freeing storage. To actually delete the files:
--   1. Run this query.
--   2. Copy the `name` values.
--   3. Either select+delete them in the Storage dashboard UI, or run
--      `supabase.storage.from('listing-photos').remove(paths)` from a
--      script using the service-role key (never the anon key).

SELECT o.name, o.created_at
FROM storage.objects o
WHERE o.bucket_id = 'listing-photos'
  AND NOT EXISTS (
    SELECT 1
    FROM listings l, unnest(l.images) AS img
    WHERE img LIKE '%/listing-photos/' || o.name
  )
ORDER BY o.created_at;
