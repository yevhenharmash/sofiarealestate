import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export function useFavouriteIds(userId: string | undefined) {
  return useQuery({
    queryKey: ['favourite-ids', userId],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('favourites').select('listing_id')
      if (error) throw error
      return new Set((data ?? []).map((row) => row.listing_id as string))
    },
    enabled: !!userId,
  })
}
