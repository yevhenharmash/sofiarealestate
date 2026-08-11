import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Listing } from '@/lib/types'

export function useMyFavouriteListings(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-favourites', userId],
    queryFn: async (): Promise<Listing[]> => {
      const { data, error } = await supabase.rpc('get_my_favourites')
      if (error) throw error
      return (data ?? []) as Listing[]
    },
    enabled: !!userId,
  })
}
