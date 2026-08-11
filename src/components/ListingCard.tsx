import { ArrowUpRight, ChevronLeft, ChevronRight, ImageOff, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FavouriteButton } from '@/components/FavouriteButton'
import { ListingImage } from '@/components/ListingImage'
import { useImageCarousel } from '@/hooks/useImageCarousel'
import { useListingTypeLabels } from '@/hooks/useListingTypeLabels'
import { useLang } from '@/lib/i18n'
import type { Listing } from '@/lib/types'
import { cn } from '@/lib/utils'

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(price) + ' €'
}

interface ListingCardProps {
  listing: Listing
  isSelected?: boolean
  onSelect?: (listing: Listing) => void
  isFavourited?: boolean
  onToggleFavourite?: (listing: Listing) => void
}

export function ListingCard({
  listing,
  isSelected,
  onSelect,
  isFavourited,
  onToggleFavourite,
}: ListingCardProps) {
  const { t } = useLang()
  const typeLabels = useListingTypeLabels()
  const images = listing.images
  const hasImages = images.length > 0
  const carousel = useImageCarousel(images)

  return (
    <Card
      onClick={() => onSelect?.(listing)}
      className={cn(
        'flex cursor-pointer flex-row gap-3 rounded-[28px] border-none p-3 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]',
        isSelected && 'ring-2 ring-primary',
      )}
    >
      <div className="relative h-[124px] w-[136px] shrink-0 overflow-hidden rounded-[20px] bg-muted">
        {hasImages ? (
          <ListingImage
            src={images[carousel.index]}
            alt={listing.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-6 w-6" />
          </div>
        )}

        {carousel.hasMultiple && (
          <>
            <button
              type="button"
              aria-label={t('listing.prevPhoto')}
              onClick={carousel.prev}
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={t('listing.nextPhoto')}
              onClick={carousel.next}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1 w-1 rounded-full bg-white/60',
                    i === carousel.index && 'bg-white',
                  )}
                />
              ))}
            </div>
          </>
        )}

        {onToggleFavourite && (
          <FavouriteButton
            isFavourited={!!isFavourited}
            onToggle={() => onToggleFavourite(listing)}
            className="absolute right-1.5 top-1.5"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-1.5">
            <span className="font-heading text-2xl leading-none text-price">{formatPrice(listing.price)}</span>
            <span className="text-[11px] text-muted-foreground">{t('listing.perMonth')}</span>
            <Badge className="ml-auto shrink-0 h-6 rounded-full bg-secondary px-3 text-secondary-foreground">
              {typeLabels[listing.type]}
            </Badge>
          </div>
          <h3 className="line-clamp-2 text-pretty text-sm font-bold leading-snug">{listing.title}</h3>
        </div>
        <div className="flex gap-1.5">
          <Button
            asChild
            size="sm"
            className="flex-1 rounded-full bg-primary hover:bg-primary-hover"
            onClick={(e) => e.stopPropagation()}
          >
            <a href={`tel:${listing.phone}`}>
              <Phone className="h-4 w-4" />
              {t('listing.call', { phone: listing.phone })}
            </a>
          </Button>
          <Button
            asChild
            size="icon-sm"
            variant="secondary"
            className="rounded-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Link to={`/listing/${listing.id}`} aria-label={t('listing.open')}>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  )
}
