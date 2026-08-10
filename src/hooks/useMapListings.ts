import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Listing, ListingFilters, MapBounds } from '@/lib/types'

const ROW_LIMIT = 500

export function useMapListings(bounds: MapBounds | null, filters: ListingFilters) {
  return useQuery({
    queryKey: ['listings', bounds, filters],
    queryFn: async (): Promise<Listing[]> => {
      if (!bounds) return []

      const { data, error } = await supabase.rpc('get_listings_in_bounds', {
        min_lng: bounds.minLng,
        min_lat: bounds.minLat,
        max_lng: bounds.maxLng,
        max_lat: bounds.maxLat,
        max_price: filters.maxPrice ?? null,
        listing_type: filters.type ?? null,
        row_limit: ROW_LIMIT,
      })

      if (error) throw error
      return (data ?? []) as Listing[]
    },
    enabled: bounds !== null,
    placeholderData: (previous) => previous,
  })
}
