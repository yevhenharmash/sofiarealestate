# Bulgarian Real Estate Map App — POC Plan

Lightweight map-first listing app. Supabase (Postgres + PostGIS) backend,
Vite + React + Tailwind + shadcn/ui frontend, react-leaflet for the map,
deployed on Vercel.

Estimated build time: **2–3 days** for a working, reasonably polished MVP
(the original 6–8h estimate didn't account for RLS/security, image upload
UX, and mobile polish).

---

## Phase 1: Database & Backend Setup (Supabase)

1. **Create Project:** free Supabase project.
2. **Enable PostGIS:** Database → Extensions → `postgis`, or:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. **Schema, index, RPC, and RLS:**
   ```sql
   -- Listings table
   CREATE TABLE listings (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     title TEXT NOT NULL,
     description TEXT,
     price NUMERIC NOT NULL,          -- stored in EUR (BG adopted the euro Jan 2026)
     type TEXT NOT NULL CHECK (type IN ('room', 'flat', 'house')),
     phone TEXT NOT NULL,
     images TEXT[] DEFAULT '{}',
     location GEOGRAPHY(POINT, 4326) NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Spatial index — required, the bounding-box query below full-scans without it
   CREATE INDEX listings_location_gix ON listings USING GIST (location);

   -- Spatial bounding-box search function (capped to avoid huge payloads when zoomed out)
   CREATE OR REPLACE FUNCTION get_listings_in_bounds(
     min_lng float, min_lat float, max_lng float, max_lat float,
     max_price numeric DEFAULT NULL,
     listing_type text DEFAULT NULL,
     row_limit int DEFAULT 500
   )
   RETURNS TABLE (
     id uuid, title text, description text, price numeric,
     type text, phone text, lat float, lng float, images text[]
   )
   LANGUAGE sql STABLE AS $$
     SELECT
       id, title, description, price, type, phone,
       ST_Y(location::geometry) as lat,
       ST_X(location::geometry) as lng,
       images
     FROM listings
     WHERE location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
       AND (max_price IS NULL OR price <= max_price)
       AND (listing_type IS NULL OR type = listing_type)
     LIMIT row_limit;
   $$;

   -- Row Level Security — anon key is public, so this is not optional
   ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Public read" ON listings
     FOR SELECT USING (true);

   CREATE POLICY "Public insert" ON listings
     FOR INSERT WITH CHECK (true); -- see anti-abuse note in Phase 3
   ```
4. **Storage Bucket:** public bucket `listing-photos`.
   - Set a max file size (e.g. 5MB) and restrict MIME types to `image/*` in bucket settings.
   - Add a storage RLS policy allowing public `INSERT`/`SELECT`, no `DELETE`/`UPDATE` from anon.

---

## Phase 2: Frontend Base Setup (Vite + React + Tailwind)

1. **Scaffold:**
   ```bash
   npm create vite@latest bg-real-estate -- --template react-ts
   cd bg-real-estate
   npm install @tanstack/react-query @supabase/supabase-js lucide-react
   npm install react-leaflet leaflet
   npm install -D @types/leaflet
   ```
2. **Tailwind + shadcn/ui:**
   ```bash
   npx tailwindcss init -p
   npx shadcn@latest init
   npx shadcn@latest add button input dialog sheet badge card drawer slider
   ```
3. **Map tiles:** OpenStreetMap tile layer (free, no API key needed) — fits naturally with react-leaflet.
4. **Marker clustering:** `react-leaflet-cluster` (wraps `leaflet.markercluster`) — needed once listing count grows past ~50-100, otherwise the map gets unreadable when zoomed out.
5. **Address search:** Nominatim (OSM's free geocoding API) for a "search by address/neighborhood" bar — no key required, works fine with Bulgarian/Cyrillic addresses. Respect Nominatim's usage policy (rate limit, User-Agent header) even in POC.

---

## Phase 3: Core Features & Architecture

```
src/
├── lib/
│   └── supabaseClient.ts     # Supabase init (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
├── hooks/
│   └── useMapListings.ts     # React Query hook calling rpc('get_listings_in_bounds')
├── components/
│   ├── MapView.tsx           # react-leaflet map + clustered pins
│   ├── ListingCard.tsx       # title, price pill, image carousel, call button
│   ├── FilterBar.tsx         # price range + type filter, feeds into useMapListings
│   ├── PostModal.tsx         # listing creation form (title, price, type, map pin, photos)
│   └── MobileTogglePill.tsx  # floating List/Map toggle for mobile
└── App.tsx                   # desktop split-view layout (Left: List, Right: Map)
```

### Key Functional Pieces

- **Listing Card:** title, price pill (EUR), image carousel, `<a href="tel:...">` call button.
- **Map Sync:** update viewport bounds (`sw`/`ne`) on `moveend`/`zoomend`, feeding React Query so pins re-fetch automatically. Debounce the bounds update (~300ms) to avoid firing on every drag frame.
- **Filters:** price range + type passed as RPC args alongside bounds, not filtered client-side (keeps payload small).
- **Posting Flow:**
  - Click-to-drop-pin on a small map inside `PostModal`, or use device geolocation as a default.
  - Compress/resize images client-side (e.g. `browser-image-compression`) before upload — avoids multi-MB uploads over mobile data.
  - Validate phone format (Bulgarian mobile pattern) before submit.
  - Insert as:
    ```typescript
    location: `POINT(${longitude} ${latitude})`
    ```
  - **Anti-abuse for POC:** since there's no auth, add at minimum a honeypot field and a simple per-IP rate limit (Supabase Edge Function in front of the insert, or a Postgres trigger checking recent inserts from the same session). Not bulletproof, but stops naive spam bots. Revisit with real auth (magic link / phone OTP) before public launch.

---

## Phase 4: Vercel Deployment

1. **`vercel.json`** at project root:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
2. Push to GitHub, connect repo to Vercel.
3. **Env vars in Vercel:**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

---

## Open Items / Things to Decide Before Building

- **Currency:** Bulgaria adopted the euro (Jan 2026) — plan above stores/displays `price` in EUR. Confirm this matches current expectations before writing copy/labels.
- **Auth for posting:** none in this POC. Fine for a demo, risky for anything public — revisit before real users touch it.
- **Moderation:** no report/flag/remove-listing flow yet. Out of scope for POC, but real estate listing sites are a common spam/fraud target — needed before launch.
- **Row cap on `get_listings_in_bounds`:** currently 500. Fine for POC data volumes; if it grows, move to server-side clustering (PostGIS `ST_ClusterKMeans` or a materialized grid) instead of shipping raw points to the client.
