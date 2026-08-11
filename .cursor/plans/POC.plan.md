# Bulgarian Real Estate Map App — Remaining Work

The POC's schema, RPCs, RLS, storage bucket, and all planned frontend
components (map, clustering, filters, address search, posting flow, mobile
toggle) are implemented in the repo. Google auth is also fully implemented.
The live Supabase project is provisioned and all migrations are applied.
What's left is deployment plus a couple of explicitly-deferred items.

---

## Backend (BE)

1. **Moderation:** no report/flag/remove-listing flow exists yet. Out of
   scope for the POC demo, but real estate listing sites are a common
   spam/fraud target — needed before any public launch.
2. **Row cap on `get_listings_in_bounds`:** currently capped at 500 rows.
   Fine for POC data volumes; if listing count grows, move to server-side
   clustering (PostGIS `ST_ClusterKMeans` or a materialized grid) instead of
   shipping raw points to the client.

---

## Frontend (FE)

1. **Deploy to Vercel:**
   - Push the repo to GitHub and import it into Vercel.
   - Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel
     project's environment variables.
