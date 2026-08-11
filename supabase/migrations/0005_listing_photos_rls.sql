-- Fixes a gap from 0001_init.sql: the listing-photos bucket only ever had
-- SELECT + INSERT policies. There was no UPDATE/DELETE policy at all, so
-- every "remove this photo" call (edit, delete listing) has been silently
-- failing since launch — the objects never actually left storage.
--
-- Uploads are now namespaced by owner (`${userId}/${uuid}.ext`, see
-- uploadListingImages in src/lib/listingImages.ts) so we can scope
-- update/delete to "your own folder" via storage.foldername(name)[1].
-- Pre-existing flat-path objects (no owner folder) won't match this policy
-- and need the manual cleanup query instead — see
-- supabase/scripts/find-orphaned-listing-photos.sql.

DROP POLICY IF EXISTS "Public upload listing photos" ON storage.objects;

CREATE POLICY "Owners can upload own listing photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'listing-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Owners can update own listing photos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'listing-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Owners can delete own listing photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'listing-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );
