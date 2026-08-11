# Bulgarian Real Estate Map App — Remaining Work

The POC's schema, RPCs, RLS, storage bucket, and all planned frontend
components (map, clustering, filters, address search, posting flow, mobile
toggle) are implemented in the repo. What's left is operational setup plus a
couple of explicitly-deferred items.

---

## Backend (BE)

1. **Provision the live Supabase project** (if not already done):
   - Enable the `postgis` extension.
   - Run `supabase/migrations/0001_init.sql` then `0002_get_listing_by_id.sql`.
   - Verify the `listing-photos` storage bucket exists with the size/MIME
     limits and RLS policies from the migration.
2. **Moderation:** no report/flag/remove-listing flow exists yet. Out of
   scope for the POC demo, but real estate listing sites are a common
   spam/fraud target — needed before any public launch.
3. **Auth for posting:** tracked separately in
   [google-auth.plan.md](google-auth.plan.md) (Google sign-in via Supabase
   Auth, gating "Post a listing", profile popover with saved phone numbers).
4. **Row cap on `get_listings_in_bounds`:** currently capped at 500 rows.
   Fine for POC data volumes; if listing count grows, move to server-side
   clustering (PostGIS `ST_ClusterKMeans` or a materialized grid) instead of
   shipping raw points to the client.

---

## Frontend (FE)

1. **Deploy to Vercel** (if not already done):
   - Push the repo to GitHub and import it into Vercel.
   - Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel
     project's environment variables.
2. **Auth UI:** once the BE auth migration lands, wire up the frontend per
   [google-auth.plan.md](google-auth.plan.md) (sign-in avatar, profile
   popover, gated `PostModal`).
