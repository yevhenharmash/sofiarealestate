import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthProvider'

interface ToggleFavouriteInput {
  listingId: string
  isFavourited: boolean
}

export function useToggleFavourite() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ listingId, isFavourited }: ToggleFavouriteInput) => {
      if (!user) return

      if (isFavourited) {
        const { error } = await supabase
          .from('favourites')
          .delete()
          .eq('user_id', user.id)
          .eq('listing_id', listingId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('favourites')
          .insert({ user_id: user.id, listing_id: listingId })
        if (error) throw error
      }
    },
    onError: (err) => {
      // supabase-js only throws a `PostgrestError` instance when `.throwOnError()`
      // is chained; the plain `if (error) throw error` pattern used above throws
      // the raw `{ message, code, ... }` object instead, so `instanceof Error`
      // would miss it and always fall back to the generic message.
      const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : undefined
      toast.error(message || 'Something went wrong')
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['favourite-ids', user?.id] })
      await queryClient.invalidateQueries({ queryKey: ['my-favourites', user?.id] })
    },
  })
}
