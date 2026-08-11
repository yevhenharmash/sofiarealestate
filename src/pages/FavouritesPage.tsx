import { ChevronLeft } from 'lucide-react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { Header } from '@/components/Header'
import { MapView } from '@/components/MapView'
import { ListingCard } from '@/components/ListingCard'
import { Button } from '@/components/ui/button'
import { useMyFavouriteListings } from '@/hooks/useMyFavouriteListings'
import { useToggleFavourite } from '@/hooks/useToggleFavourite'
import { useAuth } from '@/lib/AuthProvider'
import { useLang } from '@/lib/i18n'
import type { Listing } from '@/lib/types'
import type { LayoutContext } from '@/App'

export function FavouritesPage() {
  const { openPostModal } = useOutletContext<LayoutContext>()
  const { t } = useLang()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: listings = [], isLoading } = useMyFavouriteListings(user?.id)
  const { mutate: toggleFavourite } = useToggleFavourite()

  function handleToggleFavourite(listing: Listing) {
    toggleFavourite({ listingId: listing.id, isFavourited: true })
  }

  return (
    <div className="flex h-screen flex-col">
      <Header onOpenPostModal={openPostModal} />

      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        <div className="flex-1 overflow-y-auto">
          <Link to="/" className="mb-3 flex items-center gap-1.5 text-sm font-bold text-primary">
            <ChevronLeft className="h-4 w-4" />
            {t('favourites.back')}
          </Link>

          <div className="mb-6">
            <h1 className="font-heading text-3xl">{t('favourites.title')}</h1>
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">{t('favourites.loading')}</p>}

          {!isLoading && listings.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <h3 className="text-xl font-bold">{t('favourites.emptyTitle')}</h3>
              <p className="max-w-sm text-sm text-muted-foreground">{t('favourites.emptyText')}</p>
              <Button asChild className="mt-2 rounded-full bg-primary hover:bg-primary-hover">
                <Link to="/">{t('favourites.browseListings')}</Link>
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onSelect={(l) => navigate(`/listing/${l.id}`)}
                isFavourited
                onToggleFavourite={handleToggleFavourite}
              />
            ))}
          </div>
        </div>

        <div className="relative isolate hidden w-[380px] shrink-0 overflow-hidden rounded-[28px] lg:block">
          <MapView listings={listings} onMarkerClick={(l) => navigate(`/listing/${l.id}`)} />
        </div>
      </div>
    </div>
  )
}
