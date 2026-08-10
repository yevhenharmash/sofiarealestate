import { useState } from 'react'
import { ChevronLeft, ChevronRight, ImageOff, Phone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Listing } from '@/lib/types'
import { LISTING_TYPE_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(price) + ' €'
}

interface ListingCardProps {
  listing: Listing
  isSelected?: boolean
  onSelect?: (listing: Listing) => void
}

export function ListingCard({ listing, isSelected, onSelect }: ListingCardProps) {
  const [imageIndex, setImageIndex] = useState(0)
  const images = listing.images
  const hasImages = images.length > 0

  function goToImage(delta: number, e: React.MouseEvent) {
    e.stopPropagation()
    setImageIndex((prev) => (prev + delta + images.length) % images.length)
  }

  return (
    <Card
      onClick={() => onSelect?.(listing)}
      className={cn(
        'cursor-pointer overflow-hidden py-0 transition-colors hover:border-primary/50',
        isSelected && 'border-primary ring-1 ring-primary',
      )}
    >
      <div className="relative aspect-[4/3] w-full bg-muted">
        {hasImages ? (
          <img
            src={images[imageIndex]}
            alt={listing.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-8 w-8" />
          </div>
        )}

        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => goToImage(-1, e)}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => goToImage(1, e)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1.5 w-1.5 rounded-full bg-white/60',
                    i === imageIndex && 'bg-white',
                  )}
                />
              ))}
            </div>
          </>
        )}

        <Badge className="absolute left-2 top-2 bg-card text-card-foreground shadow">
          {formatPrice(listing.price)}
        </Badge>
      </div>

      <CardContent className="space-y-1.5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-semibold">{listing.title}</h3>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {LISTING_TYPE_LABELS[listing.type]}
          </Badge>
        </div>
        {listing.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{listing.description}</p>
        )}
        <Button asChild size="sm" className="mt-2 w-full" onClick={(e) => e.stopPropagation()}>
          <a href={`tel:${listing.phone}`}>
            <Phone className="h-4 w-4" />
            Call {listing.phone}
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
