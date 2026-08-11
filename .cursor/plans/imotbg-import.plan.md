# Import imot.bg rental listings into the database

## Implementation status (2026-08-11)

**Code-complete, not yet live.** Everything below was built and verified offline; nothing has touched the production Supabase project yet (no migration push, no function deploy, no cron) — paused there deliberately pending a separate go-ahead, since those steps write real scraped data and start a recurring live crawl.

Done:
- `supabase/migrations/0008_imotbg_import.sql` (renumbered from the `0005` in this doc — `0005`–`0007` were taken by unrelated work that landed first; `0007_favourites.sql` is already applied remotely, so this migration supersedes its `get_my_favourites` too instead of editing it in place).
- `supabase/functions/scrape-imotbg/index.ts` + `sofia-districts.ts` (44 Sofia districts).
- Frontend: `Listing` type, `ListingCard`/`ListingDetailPage` attribution UI, i18n keys, a new `MapListing` type (see Frontend changes below for why).
- Parser verified offline against two real saved fixtures (`supabase/functions/scrape-imotbg/fixtures/`) — see Verification §1.

Key finding not anticipated by the original investigation: **imot.bg is now behind Cloudflare and blocks plain requests outright** — even `robots.txt` returns 403 regardless of User-Agent/headers. Confirmed this does *not* affect the actual architecture: a throwaway diagnostic Edge Function deployed to the real Supabase project got a clean 200 from the same URL, so Deno Deploy's egress isn't blocked, only some other networks are. No workaround needed, but worth knowing if a future run starts failing — check whether Cloudflare has extended the block to Supabase's IP ranges before assuming the parser broke.

Still pending, in order: push the migration → deploy the function → one manual invocation to confirm real rows land correctly → `pg_cron` schedule. See Verification §2–6.

## Context

The app currently only has listings that users post themselves through `PostModal`. To make the map feel alive from day one, we want to backfill it with real Sofia rental listings scraped from `imot.bg`.

Investigation findings that shape this plan:
- imot.bg's `/obiavi/naemi/grad-sofiya` search results and individual `/obiava-<id>-...` detail pages are plain server-rendered HTML (windows-1251 encoded), not a JS app. `robots.txt` has no `Disallow`, and pages carry `<meta name="robots" content="index, follow">`.
- The public pages **do not expose exact coordinates** — the location section is a login-gated popup (`openLogPopup`); only a neighborhood name like "град София, Оборище" is public. Our `listings.location` column is `NOT NULL`, so imported rows need an approximate, geocoded point instead of a real pin.
- Per user decision: run the scraper as a **Supabase Edge Function + Supabase Cron**, staying inside the existing stack (this app currently has zero backend/serverless code — just the Vite SPA talking to Supabase, deployed on Vercel with static rewrites only).
- Per user decision: import all listings, including private sellers' phone numbers, and handle any removal requests reactively rather than pre-filtering to agency listings.
- Scraped rows must never look owner-editable and must never show up under a real user's "My Listings" — this falls out naturally since `listings.user_id` is already nullable (added in `0003_auth_profiles.sql`) and `get_my_listings()` filters `WHERE user_id = auth.uid()`.

## Database changes — `supabase/migrations/0008_imotbg_import.sql`

1. **New columns on `listings`**:
   - `source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user','imotbg'))`
   - `source_url TEXT UNIQUE` — canonical `imot.bg` detail URL, null for user posts; doubles as the dedup key across scrape runs
   - `location_precision TEXT NOT NULL DEFAULT 'exact' CHECK (location_precision IN ('exact','approximate'))`
   - `last_seen_at TIMESTAMPTZ` — stamped on every scrape pass that still finds the listing; null for user posts

2. **Fix a latent gap that this feature depends on**: `get_listings_in_bounds` and `get_listing_by_id` (from `0001_init.sql`/`0002_get_listing_by_id.sql`) never filter on `status` at all, even though `status` (`active`/`draft`/`expired`) was added in `0004_listing_status.sql`. Without this fix, expiring stale imported listings would have no visible effect. Add `AND status = 'active'` to both. **Implemented as `DROP FUNCTION` + recreate for both**, not `CREATE OR REPLACE` as originally planned — the row shape also changes here (see Frontend changes below for why get_my_favourites needed the same three columns), and Postgres rejects a return-shape change via `CREATE OR REPLACE`.

3. **`upsert_scraped_listing(...)` — `SECURITY DEFINER` RPC**, the single write path for the importer (mirrors the existing pattern of putting listing logic behind SQL functions: `get_listings_in_bounds`, `get_listing_by_id`, `get_my_listings`). Takes title/description/price/type/phone/images/lat/lng/source_url/location_precision, does `INSERT ... ON CONFLICT (source_url) DO UPDATE SET price, description, images, last_seen_at = NOW(), status = 'active'`. Always sets `user_id = NULL`, `source = 'imotbg'`. **Correction found during implementation**: a list-page-only refresh pass (existing `source_url`, no detail fetch) has no description/images to offer and would otherwise wipe the previously-stored values with `NULL`/`'{}'` on every 15-minute cycle. Fixed with `COALESCE(EXCLUDED.description, listings.description)` and an equivalent `CASE` for `images`, so only a real detail-page fetch (new listing) actually overwrites them. Also locked down with `REVOKE EXECUTE ... FROM PUBLIC` / `GRANT ... TO service_role` on both write RPCs (this one and `expire_stale_imotbg_listings`) — being `SECURITY DEFINER`, they'd otherwise be callable by the anon key too, letting anyone insert/expire rows outside the normal auth+RLS path.

4. **`expire_stale_imotbg_listings(cutoff INTERVAL DEFAULT '2 days')`**: `UPDATE listings SET status = 'expired' WHERE source = 'imotbg' AND status = 'active' AND last_seen_at < NOW() - cutoff`. Called at the end of each full crawl cycle.

5. **Rate-limit trigger fix**: `enforce_listing_insert_rate_limit()` (from `0001_init.sql`) fires on every insert regardless of caller — it's a plain trigger, not an RLS policy, so the service-role key used by the importer would otherwise get capped at 5 inserts/hour like anonymous users. Add `IF auth.role() = 'service_role' THEN RETURN NEW; END IF;` at the top.

6. **Singleton cursor table** `imotbg_scrape_state (id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id), next_page INT NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ DEFAULT NOW())`, seeded with one row. Lets each invocation pick up list-page pagination where the last one left off instead of restarting from page 1.

No RLS policy changes needed: inserts go through the `SECURITY DEFINER` RPC called with the service-role key (bypasses RLS already), and the existing owner-only UPDATE/DELETE policies (`auth.uid() = user_id`) naturally exclude scraped rows since their `user_id` is `NULL`.

## Scraper — `supabase/functions/scrape-imotbg/index.ts`

Deno edge function, using `npm:cheerio` for HTML parsing (Edge Functions support `npm:` specifiers) and `TextDecoder('windows-1251')` to decode fetched pages before parsing.

**Per invocation** (bounded so it finishes well inside the Edge Function execution limit):
1. Read `next_page` from `imotbg_scrape_state`.
2. Fetch 5 search-result pages starting there (`https://www.imot.bg/obiavi/naemi/grad-sofiya` for page 1, `.../p-{n}` for page `n > 1` — confirmed via the real pagination markup, which links exactly that pattern), one request at a time with a ~1s delay and a custom `User-Agent` identifying the bot + a contact email.
3. From each result page, parse per-listing (container `div.item`; one stray non-listing `div.item.fakti` news-teaser widget was found on a real page and is naturally excluded since it has no `.price`): `source_url` + title from `.zaglavie a.title` (its `href`, and its own text with the nested `<location>` child removed), district from that same `<location>` child's text, price from `.price div` (skipped if it doesn't contain `€` — confirmed BGN-only/no-price ads exist). This alone is enough to refresh price/`last_seen_at` for listings we already have. Existing-vs-new is checked with one batched `source_url IN (...)` query per page rather than one query per listing.
4. For listings whose `source_url` is new, fetch the detail page and additionally parse: description (`.moreInfo .text`), phone, images (`.owl-carousel img[data-src]`, deduped and capped at `MAX_LISTING_IMAGES`), and type classification from title keywords. **Phone selector confirmed via a real fixture** (`obiava-2b178608183757853`) — the page has *four* different `.phone` occurrences (two in an agency contact block, one that's actually a contact-form label with no digits, one in the sidebar summary box), so the parser regex-matches a phone-shaped number specifically out of `.contactsBox .phone` (the sidebar box next to the price), which was the only unambiguous one across the fixture. New listings with no phone match are skipped (not inserted) rather than violating the `phone NOT NULL` constraint. Real title text uses `N-СТАЕН` (e.g. `2-СТАЕН`), not the spelled-out `Двустаен` originally assumed — matched via `/стаен/` which covers both forms; `Стая`/`Стаи` (room) and `Къща`/`Вила` (house) checked first so they don't get caught by the broader `стаен` pattern; unmatched titles (e.g. `ОФИС` — this search endpoint isn't apartments-only) default to `flat` with a logged warning.
5. Geocode: map the district name to an approximate `[lat, lng]` via a hardcoded lookup table of 44 well-known Sofia neighborhoods (seeded from public OSM/Wikipedia centroids, not from imot.bg — see `sofia-districts.ts`), each with a small random jitter (~150m) so pins don't stack exactly. Unmatched districts fall back to `SOFIA_CENTER` (a local copy in the edge function — Deno functions can't import from `src/`) with a larger jitter (~800m); `location_precision` is always `'approximate'` for scraped rows either way.
6. Call `upsert_scraped_listing` via `supabase-js` using the **service-role key** — `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are auto-injected into every Edge Function's environment, no manual secret setup needed.
7. Advance and persist `next_page` **after every page**, not just at the end of the run — if the function gets killed mid-run (execution-time limit), progress up to the last completed page survives; the aborted page's items just get safely re-upserted (idempotent) on the next tick. Wrap back to `1` once a page comes back with zero items (past the last page), and on wraparound call `expire_stale_imotbg_listings()`.

## Scheduling

Supabase Cron (`pg_cron` + `pg_net`) invoking the function every 15 minutes via HTTP with the service-role key in the `Authorization` header. At 5 list pages per run and 25 total pages currently listed for Sofia rentals (40 listings/page, confirmed from the real pagination footer — fewer pages than the ~40+ originally estimated, not a problem, just faster full-catalog cycling), the full catalog cycles through in a bit over an hour — frequent enough to keep prices fresh, spread out enough to stay polite. **Not set up yet** — pending go-ahead, since this starts an indefinite recurring live crawl.

## Frontend changes

- `src/lib/types.ts`: add `source: 'user' | 'imotbg'` and `locationPrecision: 'exact' | 'approximate'` to `Listing` (and `source_url` isn't needed client-side except to link back to the original — add `sourceUrl: string | null` too).
- `get_listings_in_bounds` / `get_listing_by_id` SQL: include the new columns in their `RETURNS TABLE` and `SELECT` (needs `DROP FUNCTION` first for `get_listings_in_bounds` since its row shape changes, same as the pattern already used in `0002_get_listing_by_id.sql`). **`get_my_favourites` (from `0007_favourites.sql`, which landed after this plan was written) needed the same treatment** — `FavouritesPage` renders favourited listings through the same `ListingCard`, so a favourited scraped listing needs `source`/`sourceUrl`/`locationPrecision` too, or its attribution silently wouldn't show.
- `src/components/ListingCard.tsx` and `src/pages/ListingDetailPage.tsx`: when `listing.source === 'imotbg'`, show a small attribution line linking to `listing.sourceUrl` (reuse the existing `Badge` component already imported in both files) instead of / alongside the current `t('detail.postedBy')` text. Add the new i18n keys in `src/lib/i18n.tsx` next to the existing `detail.postedBy`.
- Same spot: when `locationPrecision === 'approximate'`, add a short "approximate location" note — no new marker component needed, the jittered point already renders fine through the existing `MapView.tsx` pin styling.
- **Unplanned but necessary**: adding those 3 required fields to `Listing` broke `MapView`'s prop type against `OwnedListing[]` (used by `MyListingsPage`) — the two types had been structurally interchangeable by coincidence, since `OwnedListing` previously had every field `Listing` had. Fixed by adding a `MapListing = Pick<Listing, 'id'|'title'|'price'|'type'|'lat'|'lng'|'images'>` type in `src/lib/types.ts` and narrowing `MapView`/`MapPopupCard` to it — the map/popup never actually used the new source fields anyway.

## Verification

1. **Done.** Parser correctness offline: fetched one real search-result page and one real detail page (via a throwaway diagnostic Edge Function, since Cloudflare blocks direct fetches from outside Supabase's infra — see Implementation status above), saved as fixtures in `supabase/functions/scrape-imotbg/fixtures/`, and ran the actual parsing logic against them (Node+cheerio, mirroring the Deno function's logic exactly). All fields — title, district, price, type, phone, images — matched what's visible on the live page for `obiava-2b178608183757853`, and the one non-listing `div.item` on the page (a news-teaser widget) was correctly excluded.
2. **Pending.** `supabase functions serve scrape-imotbg` locally against a local/staging Supabase project, invoke with `curl`, and confirm rows land in `listings` with `source='imotbg'`, correct `location_precision`, and a jittered point near the right Sofia neighborhood.
3. **Pending.** Re-run the function and confirm existing `source_url` rows update (price/`last_seen_at`) rather than duplicating.
4. **Pending.** Manually set a scraped row's `last_seen_at` to 3 days ago, call `expire_stale_imotbg_listings()`, and confirm it flips to `status='expired'` and disappears from `get_listings_in_bounds` — this also confirms the status-filter fix in step 2 of the migration actually works.
5. **Pending.** Sign in as a normal user and confirm scraped listings don't appear in `get_my_listings()` and can't be updated/deleted via the owner RPCs.
6. **Pending.** In the running app: confirm the map renders scraped pins, `ListingCard`/`ListingDetailPage` show the imot.bg attribution + approximate-location note, and the `tel:` call button works with the scraped phone number.
