# Image storage fixes, profile photos, fullscreen viewer, listing phone numbers

Date: 2026-08-11
Status: Approved, pending implementation

## Context

Four related items from `.cursor/plans/todos.md`:

1. Fullscreen mode for listing images.
2. The "photo upload coming soon" placeholder text on the profile popover — decide whether to build the real feature.
3. Whether orphaned images (uploaded to storage but never/no-longer referenced by a row) get cleaned up, and how.
4. Letting someone type a brand-new phone number while posting a listing, not just pick from previously saved ones.

Investigating #3 surfaced a real bug: `supabase/migrations/0001_init.sql` only grants `SELECT` and `INSERT` policies on the `listing-photos` storage bucket. There is no `DELETE` or `UPDATE` policy, and `deleteListingImages()` (`src/lib/listingImages.ts`) never inspects the `{ error }` returned by `.storage.remove()`. So every "delete this photo" call — on listing deletion and on removing a photo while editing — has been silently failing since launch; the objects never actually leave storage. This design fixes that as part of the broader image-storage work.

## A. Fix `listing-photos` storage RLS + provide a one-off cleanup query

**Path scheme change.** `uploadListingImages(files, userId)` gains a required `userId` param and uploads to `${userId}/${uuid}.${ext}` instead of the current flat `${uuid}.${ext}`. Both call sites already have `user.id` in scope:
- `src/components/PostModal.tsx` → `handleSubmit`
- `src/pages/MyListingsPage.tsx` → `saveEdit`

**Migration (`supabase/migrations/0005_listing_photos_rls.sql`):**
- Drop `"Public upload listing photos"`.
- Add owner-scoped policies keyed on the first path segment matching `auth.uid()`:
  ```sql
  CREATE POLICY "Owners can upload own listing photos" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'listing-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
  CREATE POLICY "Owners can update own listing photos" ON storage.objects
    FOR UPDATE USING (bucket_id = 'listing-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
  CREATE POLICY "Owners can delete own listing photos" ON storage.objects
    FOR DELETE USING (bucket_id = 'listing-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
  ```
- `"Public read listing photos"` stays untouched — listing photos must remain publicly viewable by signed-out visitors.

**Code fix.** `deleteListingImages()` checks the returned `error` and `console.error`s it instead of silently discarding it. It still doesn't throw — callers treat cleanup as best-effort, per the existing comment.

**Known limitation.** Pre-migration objects have no owner folder, so the new owner-scoped `DELETE` policy can never match them — they're not retroactively fixable via the app. That's what the cleanup query below is for.

**Cleanup query** (new file `supabase/scripts/find-orphaned-listing-photos.sql`, run manually in the Supabase SQL editor as needed — not automated):
```sql
-- Lists listing-photos objects not referenced by any listing's images[].
-- NOTE: deleting rows from storage.objects via SQL only removes metadata,
-- not the underlying file blob. To actually delete the files, copy the
-- resulting paths into the Storage dashboard's multi-select delete, or
-- pass them to `supabase.storage.from('listing-photos').remove(paths)`
-- using the service-role key.
SELECT o.name, o.created_at
FROM storage.objects o
WHERE o.bucket_id = 'listing-photos'
  AND NOT EXISTS (
    SELECT 1
    FROM listings l, unnest(l.images) AS img
    WHERE img LIKE '%/listing-photos/' || o.name
  )
ORDER BY o.created_at;
```

## B. Profile photo upload

Replaces the `profile.photoUploadUnavailable` placeholder with a real upload.

- New `avatars` storage bucket: public read, owner-scoped insert/update/delete (same `(storage.foldername(name))[1] = auth.uid()::text` pattern as A), 2MB file size limit, `image/jpeg` only (we normalize on the client before upload).
- Canonical path per user: `${userId}/avatar.jpg`. Uploads always compress to JPEG (~512px max dimension, `browser-image-compression`, same lib already used for listing photos) and upload with `{ upsert: true, contentType: 'image/jpeg' }` — a re-upload overwrites the same object, so there's no old-file bookkeeping and no ambiguity about whether a previous `avatar_url` pointed at our bucket or at Google's CDN.
- Because the path never changes, `profiles.avatar_url` is stored with a cache-busting suffix (`?v=<timestamp>`) so the new image actually displays instead of a cached copy at the same URL.
- `ProfilePopover`: clicking the avatar opens a hidden file input (same UX pattern as the existing listing-photo pickers), compresses, uploads, updates `profiles.avatar_url` via `supabase.from('profiles').update(...)`, invalidates `['profile', user.id]`, toasts success/error.
- Google avatar stays the default with zero extra logic: `avatar_url` is already seeded from Google metadata on signup (`handle_new_user()` in `0003_auth_profiles.sql`) and is simply left alone until the user uploads their own.
- New helper module `src/lib/avatarImage.ts` exporting `uploadAvatarImage(file, userId): Promise<string>`, mirroring `listingImages.ts`.
- Remove the `profile.photoUploadUnavailable` key from both dictionaries in `src/lib/i18n.tsx` (dead once the real upload ships) and the `toast(...)` call site that used it.

## C. Fullscreen image viewer (listing detail page only)

- New component `src/components/ImageLightbox.tsx`: fixed-position full-viewport overlay (portal), takes `images: string[]`, `index`, `onIndexChange`, `onClose`.
- Shares the same index as the existing `useImageCarousel` on `ListingDetailPage` — opens on whatever photo is currently displayed, and prev/next inside the lightbox updates that same shared index so the page behind it stays in sync when closed.
- Controls: click the main photo to open; close via an X button, `Escape`, or backdrop click; prev/next via chevrons and `ArrowLeft`/`ArrowRight`; same `detail.photoIndex` badge text already used on the page.
- Scope is intentionally just `ListingDetailPage`'s main photo for v1 — not `ListingCard`, not the `MyListingsPage` edit-dialog thumbnails. No swipe gesture for v1 (click/keyboard only); noting as a possible future follow-up, not building it now.
- New i18n keys: `detail.closePhoto` (aria-label for the close button) in both dictionaries.

## D. New phone number while posting a listing, saved to profile

- `PostModal`'s phone field currently: a `<Select>` of saved numbers when `savedPhones.length > 1` (no way to type a new one in that state), otherwise a plain `<Input>`. Neither path ever writes back to `profiles.phone_numbers`.
- Change: whenever there are saved numbers, the `<Select>` gains an explicit extra item ("+ add a new number") that switches the field to a text input for entering a fresh number (mirrors the `+`-button pattern already used in `ProfilePopover`). With zero saved numbers, the existing plain input is unchanged.
- On successful submit, if the phone used isn't already present in `profiles.phone_numbers` (after normalizing via `src/lib/phone.ts`'s `normalizePhone`), append it via a `profiles` update in the same `handleSubmit` flow, then invalidate `['profile', user.id]`. Validation reuses the existing `isValidMobilePhone` check already run before submit.
- New i18n keys: `postModal.addNewPhone` ("+ add a new number" / "+ добави нов номер") in both dictionaries.

## Testing

No existing automated test suite in this repo (no `test` script/config found) — verification will be manual:
- Post a listing with photos as a fresh user; confirm files land under `listing-photos/<uid>/...`.
- Edit a listing, remove a photo, confirm the object actually disappears from the Storage dashboard (previously it would not).
- Delete a listing with photos, same check.
- Upload a profile photo twice in a row; confirm the second upload overwrites (no duplicate objects) and the UI shows the new image without a hard refresh.
- Open the lightbox on a multi-photo listing; verify keyboard nav, close paths, and that closing leaves the page's carousel on the same photo.
- Post a listing with a new phone number as a user with existing saved numbers; confirm it appears in the profile popover afterward.
