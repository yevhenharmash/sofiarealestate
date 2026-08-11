# Import imot.bg rental listings into the database

## Context

The app currently only has listings that users post themselves through `PostModal`. To make the map feel alive from day one, we want to backfill it with real Sofia rental listings scraped from `imot.bg`.

Investigation findings that shape this plan:
- imot.bg's `/obiavi/naemi/grad-sofiya` search results and individual `/obiava-<id>-...` detail pages are plain server-rendered HTML (windows-1251 encoded), not a JS app. `robots.txt` has no `Disallow`, and pages carry `<meta name="robots" content="index, follow">`.
- The public pages **do not expose exact coordinates** — the location section is a login-gated popup (`openLogPopup`); only a neighborhood name like "град София, Оборище" is public. Our `listings.location` column is `NOT NULL`, so imported rows need an approximate, geocoded point instead of a real pin.
- Per user decision: run the scraper as a **Supabase Edge Function + Supabase Cron**, staying inside the existing stack (this app currently has zero backend/serverless code — just the Vite SPA talking to Supabase, deployed on Vercel with static rewrites only).
- Per user decision: import all listings, including private sellers' phone numbers, and handle any removal requests reactively rather than pre-filtering to agency listings.
- Scraped rows must never look owner-editable and must never show up under a real user's "My Listings" — this falls out naturally since `listings.user_id` is already nullable (added in `0003_auth_profiles.sql`) and `get_my_listings()` filters `WHERE user_id = auth.uid()`.

## Database changes — `supabase/migrations/0005_imotbg_import.sql`

1. **New columns on `listings`**:
   - `source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user','imotbg'))`
   - `source_url TEXT UNIQUE` — canonical `imot.bg` detail URL, null for user posts; doubles as the dedup key across scrape runs
   - `location_precision TEXT NOT NULL DEFAULT 'exact' CHECK (location_precision IN ('exact','approximate'))`
   - `last_seen_at TIMESTAMPTZ` — stamped on every scrape pass that still finds the listing; null for user posts

2. **Fix a latent gap that this feature depends on**: `get_listings_in_bounds` and `get_listing_by_id` (from `0001_init.sql`/`0002_get_listing_by_id.sql`) never filter on `status` at all, even though `status` (`active`/`draft`/`expired`) was added in `0004_listing_status.sql`. Without this fix, expiring stale imported listings would have no visible effect. Add `AND status = 'active'` to both, `CREATE OR REPLACE` (row shape is unchanged, no `DROP FUNCTION` needed).

3. **`upsert_scraped_listing(...)` — `SECURITY DEFINER` RPC**, the single write path for the importer (mirrors the existing pattern of putting listing logic behind SQL functions: `get_listings_in_bounds`, `get_listing_by_id`, `get_my_listings`). Takes title/description/price/type/phone/images/lat/lng/source_url/location_precision, does `INSERT ... ON CONFLICT (source_url) DO UPDATE SET price, description, images, last_seen_at = NOW(), status = 'active'`. Always sets `user_id = NULL`, `source = 'imotbg'`.

4. **`expire_stale_imotbg_listings(cutoff INTERVAL DEFAULT '2 days')`**: `UPDATE listings SET status = 'expired' WHERE source = 'imotbg' AND status = 'active' AND last_seen_at < NOW() - cutoff`. Called at the end of each full crawl cycle.

5. **Rate-limit trigger fix**: `enforce_listing_insert_rate_limit()` (from `0001_init.sql`) fires on every insert regardless of caller — it's a plain trigger, not an RLS policy, so the service-role key used by the importer would otherwise get capped at 5 inserts/hour like anonymous users. Add `IF auth.role() = 'service_role' THEN RETURN NEW; END IF;` at the top.

6. **Singleton cursor table** `imotbg_scrape_state (id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id), next_page INT NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ DEFAULT NOW())`, seeded with one row. Lets each invocation pick up list-page pagination where the last one left off instead of restarting from page 1.

No RLS policy changes needed: inserts go through the `SECURITY DEFINER` RPC called with the service-role key (bypasses RLS already), and the existing owner-only UPDATE/DELETE policies (`auth.uid() = user_id`) naturally exclude scraped rows since their `user_id` is `NULL`.

## Scraper — `supabase/functions/scrape-imotbg/index.ts`

Deno edge function, using `npm:cheerio` for HTML parsing (Edge Functions support `npm:` specifiers) and `TextDecoder('windows-1251')` to decode fetched pages before parsing.

**Per invocation** (bounded so it finishes well inside the Edge Function execution limit):
1. Read `next_page` from `imotbg_scrape_state`.
2. Fetch ~5 search-result pages starting there (`https://www.imot.bg/obiavi/naemi/grad-sofiya/p-{n}`), one request at a time with a ~1s delay and a custom `User-Agent` identifying the bot + a contact email (politeness, since we're an uninvited crawler).
3. From each result page, parse per-listing: `source_url` (the `/obiava-<id>-...` link), title, price (`.price` div — skip/log anything not denominated in `€`), district name, and area/floor if present. This alone is enough to refresh price/`last_seen_at` for listings we already have.
4. For listings whose `source_url` is new (not already in `listings`), fetch the detail page and additionally parse: description, phone (from the contact block's `.phone` text — verify the exact selector against a couple of live pages, since it wasn't 100% confirmed which of several `.phone` occurrences is the seller's), images (`.owl-carousel img[data-src]`), and type classification from title keywords (Едностаен/Двустаен/... apartment sizes → `flat`, Стая/Стаи → `room`, Къща/Вила → `house`; default to `flat` and log anything unmatched for later review — don't silently misclassify forever).
5. Geocode: map the district name to an approximate `[lat, lng]` via a hardcoded lookup table of ~40–50 well-known Sofia neighborhoods (seeded from public OSM/Wikipedia centroids, not from imot.bg), each with a small random jitter (~150m) so pins don't stack exactly. Unmatched districts fall back to `SOFIA_CENTER` (already defined in `src/lib/constants.ts`) with a larger jitter (~800m) and `location_precision = 'approximate'` either way.
6. Call `upsert_scraped_listing` via `supabase-js` using the **service-role key** (stored as an Edge Function secret, never shipped to the client).
7. Advance and persist `next_page`; wrap back to `1` after the last page, and on wraparound call `expire_stale_imotbg_listings()`.

## Scheduling

Supabase Cron (`pg_cron` + `pg_net`) invoking the function every 15 minutes via HTTP with the service-role key in the `Authorization` header. At ~5 list pages per run and ~40+ total pages for Sofia rentals, the full catalog cycles through in a couple of hours — frequent enough to keep prices fresh, spread out enough to stay polite.

## Frontend changes

- `src/lib/types.ts`: add `source: 'user' | 'imotbg'` and `locationPrecision: 'exact' | 'approximate'` to `Listing` (and `source_url` isn't needed client-side except to link back to the original — add `sourceUrl: string | null` too).
- `get_listings_in_bounds` / `get_listing_by_id` SQL: include the new columns in their `RETURNS TABLE` and `SELECT` (needs `DROP FUNCTION` first for `get_listings_in_bounds` since its row shape changes, same as the pattern already used in `0002_get_listing_by_id.sql`).
- `src/components/ListingCard.tsx` and `src/pages/ListingDetailPage.tsx`: when `listing.source === 'imotbg'`, show a small attribution line linking to `listing.sourceUrl` (reuse the existing `Badge` component already imported in both files) instead of / alongside the current `t('detail.postedBy')` text. Add the new i18n keys in `src/lib/i18n.tsx` next to the existing `detail.postedBy`.
- Same spot: when `locationPrecision === 'approximate'`, add a short "approximate location" note — no new marker component needed, the jittered point already renders fine through the existing `MapView.tsx` pin styling.

## Verification

1. Parser correctness offline first: save a couple of real search-result and detail pages as fixtures, feed them into the extraction functions directly (no network), and check the parsed fields (price, type, phone, images, district) against what's visibly on the page — this is what the investigation already did manually for one listing (`obiava-2b178608183757853...`), now turned into a repeatable check.
2. `supabase functions serve scrape-imotbg` locally against a local/staging Supabase project, invoke with `curl`, and confirm rows land in `listings` with `source='imotbg'`, correct `location_precision`, and a jittered point near the right Sofia neighborhood.
3. Re-run the function and confirm existing `source_url` rows update (price/`last_seen_at`) rather than duplicating.
4. Manually set a scraped row's `last_seen_at` to 3 days ago, call `expire_stale_imotbg_listings()`, and confirm it flips to `status='expired'` and disappears from `get_listings_in_bounds` — this also confirms the status-filter fix in step 2 of the migration actually works.
5. Sign in as a normal user and confirm scraped listings don't appear in `get_my_listings()` and can't be updated/deleted via the owner RPCs.
6. In the running app: confirm the map renders scraped pins, `ListingCard`/`ListingDetailPage` show the imot.bg attribution + approximate-location note, and the `tel:` call button works with the scraped phone number.
