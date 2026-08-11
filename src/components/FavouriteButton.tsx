import { Heart } from 'lucide-react'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface FavouriteButtonProps {
  isFavourited: boolean
  onToggle: () => void
  className?: string
}

export function FavouriteButton({ isFavourited, onToggle, className }: FavouriteButtonProps) {
  const { t } = useLang()

  return (
    <button
      type="button"
      aria-label={t(isFavourited ? 'listing.unfavourite' : 'listing.favourite')}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70',
        className,
      )}
    >
      <Heart className={cn('h-4 w-4', isFavourited && 'fill-current')} />
    </button>
  )
}
