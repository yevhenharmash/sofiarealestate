import { ChevronLeft, ChevronRight, Heart, ImageOff, MapPin, Phone } from 'lucide-react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { Header } from '@/components/Header'
import { ListingImage } from '@/components/ListingImage'
import { MapView } from '@/components/MapView'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useImageCarousel } from '@/hooks/useImageCarousel'
import { useListing } from '@/hooks/useListing'
import { useListingTypeLabels } from '@/hooks/useListingTypeLabels'
import { useMapListings } from '@/hooks/useMapListings'
import { useLang } from '@/lib/i18n'
import type { LayoutContext } from '@/App'

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(price) + ' €'
}

function formatRelativeTime(iso: string, lang: 'bg' | 'en'): string {
  const diffMs = new Date(iso).getTime() - Date.now()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  const rtf = new Intl.RelativeTimeFormat(lang === 'bg' ? 'bg-BG' : 'en-US', { numeric: 'auto' })
  if (diffDays === 0) return rtf.format(0, 'day')
  return rtf.format(diffDays, 'day')
}

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { openPostModal, bounds, filters } = useOutletContext<LayoutContext>()
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const typeLabels = useListingTypeLabels()

  const { data: listing, isLoading, error } = useListing(id)
  const { data: nearbyListings = [] } = useMapListings(bounds, filters)
  const images = listing?.images ?? []
  const carousel = useImageCarousel(images)

  return (
    <div className="flex h-screen flex-col">
      <Header onOpenPostModal={openPostModal} />

      {isLoading && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {t('detail.loading')}
        </div>
      )}

      {!isLoading && (error || !listing) && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <p>{t('detail.notFound')}</p>
          <Link to="/" className="font-semibold text-primary">
            {t('detail.backHome')}
          </Link>
        </div>
      )}

      {!isLoading && listing && (
        <div className="relative flex flex-1 overflow-hidden px-3 pb-3 sm:gap-3">
          <div className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto sm:w-[420px]">
            <Link
              to="/"
              className="flex items-center gap-1.5 pt-1 text-sm font-bold text-primary"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('detail.back', { count: nearbyListings.length })}
            </Link>

            <div className="relative h-[250px] shrink-0 overflow-hidden rounded-[26px] bg-muted">
              {images.length > 0 ? (
                <ListingImage
                  src={images[carousel.index]}
                  alt={listing.title}
                  className="h-full w-full object-cover"
                  iconClassName="h-8 w-8"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageOff className="h-8 w-8" />
                </div>
              )}
              {carousel.hasMultiple && (
                <>
                  <button
                    type="button"
                    aria-label={t('listing.prevPhoto')}
                    onClick={carousel.prev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('listing.nextPhoto')}
                    onClick={carousel.next}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                    {t('detail.photoIndex', { current: carousel.index + 1, total: images.length })}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-end gap-2">
              <span className="font-heading text-4xl leading-none text-price">{formatPrice(listing.price)}</span>
              <span className="pb-1 text-sm text-muted-foreground">{t('listing.perMonth')}</span>
              <button
                type="button"
                aria-label="favorite"
                className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-foreground hover:bg-muted"
              >
                <Heart className="h-[18px] w-[18px]" />
              </button>
            </div>

            <h1 className="text-2xl font-bold text-pretty">{listing.title}</h1>

            <div>
              <Badge className="h-6 rounded-full bg-secondary px-3 text-secondary-foreground">
                {typeLabels[listing.type]}
              </Badge>
            </div>

            {listing.description && (
              <p className="text-sm text-muted-foreground">{listing.description}</p>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                {formatRelativeTime(listing.createdAt, lang)} · {t('detail.postedBy')}
              </span>
            </div>

            <div className="mt-auto flex gap-2 border-t border-border pt-4">
              <Button asChild className="flex-1 rounded-full bg-primary hover:bg-primary-hover" size="lg">
                <a href={`tel:${listing.phone}`}>
                  <Phone className="h-4 w-4" />
                  {t('listing.call', { phone: listing.phone })}
                </a>
              </Button>
            </div>
          </div>

          <main className="relative isolate hidden flex-1 overflow-hidden rounded-[28px] sm:block">
            <MapView
              listings={[listing]}
              selectedId={listing.id}
              flyTo={{ lat: listing.lat, lng: listing.lng, zoom: 16 }}
              onMarkerClick={() => navigate(`/listing/${listing.id}`)}
            />
          </main>
        </div>
      )}
    </div>
  )
}
