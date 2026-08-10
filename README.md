# Имоти BG — Bulgarian Real Estate Map App (POC)

Map-first real estate listing app for Bulgaria. Browse listings on an
interactive map or list, filter by price/type, search by address, and post
your own listing with photos.

Built with Vite + React + TypeScript + Tailwind CSS + shadcn/ui +
react-leaflet, backed by Supabase (Postgres + PostGIS).

This is a frontend-first repo: everything at the root is the frontend app.
Backend/DB code lives in `supabase/` (SQL migration only — no npm project).

## Stack

- **Frontend:** Vite, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- **Map:** react-leaflet + OpenStreetMap tiles, clustering via
  `react-leaflet-cluster`, address search via Nominatim
- **Data:** TanStack Query for fetching/caching
- **Backend:** Supabase (Postgres + PostGIS, Storage, RLS)

## Getting started

1. Set up the Supabase backend (see `supabase/migrations/0001_init.sql` —
   run it in the Supabase SQL editor of a fresh project with the `postgis`
   extension available).
2. Copy the env file and fill in your Supabase project credentials:

   ```bash
   cp .env.example .env.local
   ```

   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

## Project structure

```
.
├── src/
│   ├── lib/
│   │   ├── supabaseClient.ts   # Supabase client init
│   │   ├── types.ts            # Listing / filter / bounds types
│   │   ├── phone.ts            # Bulgarian mobile number validation
│   │   └── constants.ts        # Map defaults (Sofia center, zoom)
│   ├── hooks/
│   │   ├── useMapListings.ts   # React Query hook calling rpc('get_listings_in_bounds')
│   │   ├── useAddressSearch.ts # Debounced Nominatim geocoding
│   │   └── useDebouncedValue.ts
│   ├── components/
│   │   ├── MapView.tsx         # react-leaflet map + clustered pins
│   │   ├── ListingCard.tsx     # title, price pill, image carousel, call button
│   │   ├── FilterBar.tsx       # price range + type filter + address search
│   │   ├── PostModal.tsx       # listing creation form (title, price, type, map pin, photos)
│   │   ├── LocationPicker.tsx  # mini map for dropping/dragging a pin
│   │   └── MobileTogglePill.tsx
│   └── App.tsx                 # desktop split-view layout (Left: List, Right: Map)
└── supabase/
    └── migrations/0001_init.sql  # schema, PostGIS, RPC, RLS, storage bucket, anti-abuse rate limit
```

## Deploying to Vercel

1. Push this repo to GitHub and import it into Vercel. No custom Root
   Directory needed — the frontend lives at the repo root.
2. `vercel.json` already configures the SPA rewrite so client-side routing
   (if added later) doesn't 404 on refresh.
3. Add the environment variables in the Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Notes / open items

- **Currency:** prices are stored and displayed in EUR (Bulgaria adopted the
  euro in Jan 2026).
- **Auth:** there is none for posting listings in this POC. The insert RLS
  policy is intentionally public, guarded only by a simple per-IP rate-limit
  trigger (see the migration) and a client-side honeypot field. Revisit
  before any public launch.
- **Moderation:** no report/flag/remove-listing flow yet.
- **Row cap:** `get_listings_in_bounds` caps results at 500 rows. Fine for
  POC data volumes — move to server-side clustering if it grows.
- **Nominatim usage policy:** the address search hook debounces requests and
  relies on the browser's own `Referer` header for attribution, per
  Nominatim's usage policy for lightweight/demo usage. Consider self-hosting
  or a paid geocoder before higher traffic.
