import { ArrowUpRight, ImageOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { ListingImage } from '@/components/ListingImage'
import { useListingTypeLabels } from '@/hooks/useListingTypeLabels'
import { useLang } from '@/lib/i18n'
import type { Listing } from '@/lib/types'

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(price) + ' €'
}

// Deliberately not a re-skinned ListingCard: this is a map-context glance
// preview, not a commitment surface, so it drops the carousel and call CTA
// and only keeps what helps decide whether a pin is worth opening.
export function MapPopupCard({ listing }: { listing: Listing }) {
  const { t } = useLang()
  const typeLabels = useListingTypeLabels()
  const hasImage = listing.images.length > 0

  return (
    <Link to={`/listing/${listing.id}`} className="flex w-56 gap-2.5 no-underline">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
        {hasImage ? (
          <ListingImage
            src={listing.images[0]}
            alt={listing.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="font-heading text-base leading-none text-price">{formatPrice(listing.price)}</span>
          <Badge className="ml-auto h-5 shrink-0 rounded-full bg-secondary px-2 text-[10px] text-secondary-foreground">
            {typeLabels[listing.type]}
          </Badge>
        </div>
        <h3 className="line-clamp-2 text-pretty text-xs font-bold leading-snug text-foreground">
          {listing.title}
        </h3>
        <span className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary">
          {t('listing.viewListing')}
          <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  )
}
