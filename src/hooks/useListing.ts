import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Listing } from '@/lib/types'

export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: ['listing', id],
    queryFn: async (): Promise<Listing | null> => {
      const { data, error } = await supabase.rpc('get_listing_by_id', { listing_id: id })
      if (error) throw error
      return (data?.[0] as Listing) ?? null
    },
    enabled: !!id,
  })
}
