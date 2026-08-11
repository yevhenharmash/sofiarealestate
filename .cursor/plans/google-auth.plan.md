---
name: Google Auth
overview: Add Google sign-in via Supabase Auth (behind a sign-in modal) that gates posting a listing and shows a profile popover with name, picture, and phone numbers. Sign-out is deferred to a future account page.
todos:
  - id: auth-migration
    content: Add supabase/migrations/0003_auth_profiles.sql (profiles table, trigger, listings.user_id, updated RLS)
    status: pending
  - id: auth-provider
    content: Create src/lib/AuthProvider.tsx and mount it in main.tsx
    status: pending
  - id: auth-post-intent
    content: "Preserve post-login redirect target (redirectTo: full URL) and reopen PostModal via a sessionStorage intent flag checked in App.tsx's Layout"
    status: pending
  - id: auth-signin-modal
    content: Add shadcn dialog-based SignInModal.tsx ("Continue with Google") per the Google Sign-In Popup design
    status: pending
  - id: auth-header
    content: "Update Header.tsx: sign-in avatar opens SignInModal, gate Post a listing behind auth"
    status: pending
  - id: auth-profile-popover
    content: Add shadcn avatar/popover components and build ProfilePopover.tsx (name, picture, phone numbers — no sign out, that lives on the future account page)
    status: pending
  - id: auth-postmodal
    content: Update PostModal.tsx to require auth, prefill/select saved phone numbers, set user_id on insert
    status: pending
  - id: auth-i18n
    content: Add auth.* i18n keys to i18n.tsx for bg/en
    status: pending
isProject: false
---

# Google Sign-In, Login-Gated Posting, a Sign-In Modal, and a Profile Popover

Addresses item 3 in [.cursor/plans/todos.md](.cursor/plans/todos.md): "Need google sign in: 'Post a listing' should require being logged in - same the avatar - it allows logging in. When avatar is pressed it open a popup with your info (name, picture, phone numbers - plural!)".

Today there's no auth at all: `listings` insert is public (guarded only by a per-IP rate-limit trigger + honeypot, see [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql)), and the Header's avatar/login concept doesn't exist yet ([src/components/Header.tsx](src/components/Header.tsx) only has a disabled "My listings" button and the "Post a listing" button, which opens `PostModal` unconditionally).

## 1. Manual prerequisite (outside this repo, must be done by you before this works)

- In Google Cloud Console: create an OAuth 2.0 Client ID (Web application), add the Supabase callback URL as an authorized redirect URI.
- In the Supabase Dashboard: Authentication → Providers → enable Google, paste the Client ID/Secret. Set Site URL and Redirect URLs to your app's dev/prod URLs.
- No new frontend env vars are needed — `supabase-js` handles OAuth through the existing `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`.

## 2. New migration — `supabase/migrations/0003_auth_profiles.sql`

```sql
-- Profile row per authenticated user, auto-seeded from Google metadata.
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone_numbers TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

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

-- Listings now belong to a user. Nullable on purpose: pre-existing rows have
-- no owner, and we're not backfilling them. New inserts always set it (see
-- the INSERT policy below), so it's effectively NOT NULL going forward.
-- ON DELETE SET NULL so a deleted account doesn't orphan/break its listings.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS listings_user_id_idx ON listings(user_id);

-- Posting now requires auth; drop the old public-insert policy.
DROP POLICY IF EXISTS "Public insert" ON listings;
CREATE POLICY "Authenticated users can insert own listings" ON listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

Keep the existing per-IP rate-limit trigger from `0001_init.sql` as defense-in-depth alongside the new auth requirement.

Note: `profiles` intentionally has no SELECT policy for anyone but the owner (`auth.uid() = id`). No other user, and no listing, can read someone else's name/avatar/phone — `detail.postedBy` stays a generic "Posted by owner" string. If a future request wants to show the poster's name/avatar on a listing, that needs an explicit new policy (and a product decision about exposing it).

## 3. Frontend auth state — `src/lib/AuthProvider.tsx` (new)

Wraps `supabase.auth.onAuthStateChange` + `getSession()` in a context, and fetches the matching `profiles` row via React Query once a session exists:

```tsx
interface AuthContextValue {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}
```

`signInWithGoogle` calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } })` (standard full-page redirect flow — reliable, no popup-blocker issues). Using the full current URL, not just the origin, means the user lands back where they started (e.g. a listing detail page) instead of always being bounced to `/`.

To preserve intent when sign-in was triggered by "Post a listing" (Header, step 5): before redirecting, set a `sessionStorage` flag (e.g. `imoti-post-intent=1`). On mount, once `AuthProvider` reports a session, `Layout` ([src/App.tsx](src/App.tsx)) checks and clears that flag and calls `openPostModal()` if set — so the user doesn't have to click "Post a listing" a second time after the OAuth round-trip.

Mount `<AuthProvider>` in [src/main.tsx](src/main.tsx) above `<App />`.

Add `Profile`/`User`-shaped types to [src/lib/types.ts](src/lib/types.ts).

## 4. Sign-in modal — `src/components/SignInModal.tsx` (new)

Per the "Google Sign-In Popup" design: a shadcn `Dialog` (same primitive `PostModal` already uses) rather than an instant redirect. Content: brief title/description (`auth.signInTitle`, `auth.signInDescription`) and a single "Continue with Google" button (`auth.continueWithGoogle`) that calls `signInWithGoogle()` from `AuthProvider` on click — the redirect itself still happens exactly as described in step 3 (full-page redirect, `redirectTo: window.location.href`, post-intent flag).

`open`/`onOpenChange` props, controlled from `Header` (and from `PostModal`'s gating logic, step 7) — same shape as `PostModalProps`.

## 5. Header — avatar / sign-in entry point

[src/components/Header.tsx](src/components/Header.tsx):

- Logged out: render a circular sign-in button (generic user icon) that opens `SignInModal` (step 4) instead of calling `signInWithGoogle()` directly.
- Logged in: render `ProfilePopover` (new component, step 6) showing the user's Google avatar image.
- "Post a listing" button: if logged out, clicking opens `SignInModal` instead of calling `onOpenPostModal()`.

## 6. Profile popover — `src/components/ProfilePopover.tsx` (new)

Add shadcn `avatar` and `popover` primitives (`npx shadcn@latest add avatar popover`) — the project already has the `radix-ui` combined package these are built on. Popover content shows:

- Avatar (large) + `profile.full_name`
- Phone numbers list (`profile.phone_numbers`) with inline add/remove — add validates via existing [src/lib/phone.ts](src/lib/phone.ts) `isValidBulgarianMobile`, normalizes via `normalizePhone`, and rejects duplicates (`includes` check) before updating the `profiles.phone_numbers` array via Supabase update. No hard cap on count, but dedupe keeps the list sane.

No "Sign out" here — per your note, that button will live on the account page, built later. `AuthProvider.signOut` still exists (step 3) for that future page to call; this popover just doesn't expose it yet. Until the account page exists, sign-out for local testing means clearing site storage / an incognito window / the Supabase dashboard.

## 7. PostModal — require auth + use saved numbers

[src/components/PostModal.tsx](src/components/PostModal.tsx):

- Read `user`/`profile` from `AuthProvider`. Since Header now prevents opening the modal while logged out, add a defensive early return/close if `user` is ever null on submit.
- Prefill `form.phone` from `profile.phone_numbers[0]` if present; if the user has multiple saved numbers, offer a `Select` to choose one (falls back to free-text entry, matching current behavior).
- Include `user_id: user.id` in the `supabase.from('listings').insert(...)` call.

## 8. i18n additions

Add to both `bg`/`en` dictionaries in [src/lib/i18n.tsx](src/lib/i18n.tsx): `auth.signInTitle`, `auth.signInDescription`, `auth.continueWithGoogle`, `auth.phoneNumbers`, `auth.addPhone`, `auth.phonePlaceholder`, `auth.removePhone`. (`auth.signOut` is deferred to whenever the account page is built, since nothing renders it yet.)

## Out of scope (noted, not building now)

- The account page itself, including the "Sign out" button — this plan only keeps `AuthProvider.signOut` available for it to call later.
- Activating the existing disabled "My listings" button (would now be possible via `user_id`, but not part of this request).
- Listing edit/delete, moderation/reporting — unrelated to this request.

## Verification

After implementing, confirm manually (no automated test suite exists yet):

- Signed out: Header shows the generic sign-in avatar; clicking it or "Post a listing" opens `SignInModal`; clicking "Continue with Google" there redirects to Google, and back to the same page (not `/`) after consent.
- First-ever Google sign-in creates exactly one `profiles` row (check via SQL editor) with `full_name`/`avatar_url` populated from Google metadata.
- Signed in: `ProfilePopover` opens on avatar click, shows correct name/picture; adding a phone number persists after a page refresh; adding a duplicate is rejected; removing one persists. No sign-out control is present (expected — deferred to the account page).
- Posting a listing while signed in succeeds and the inserted row has the correct `user_id`; posting via a raw anon-key request (e.g. curl/SQL) without a session is rejected by RLS.
- If sign-in was triggered from "Post a listing", `SignInModal` closes, the OAuth redirect completes, and `PostModal` reopens automatically.
- To re-test signed-out state, clear site storage or use an incognito window (no sign-out UI exists yet).
