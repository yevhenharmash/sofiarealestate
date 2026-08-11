import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { OwnedListing } from '@/lib/types'

export function useMyListings(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-listings', userId],
    queryFn: async (): Promise<OwnedListing[]> => {
      const { data, error } = await supabase.rpc('get_my_listings')
      if (error) throw error
      return (data ?? []) as OwnedListing[]
    },
    enabled: !!userId,
  })
}
