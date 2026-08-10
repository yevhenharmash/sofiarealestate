import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Header } from '@/components/Header'
import { MapView } from '@/components/MapView'
import { ListingCard } from '@/components/ListingCard'
import { FilterBar } from '@/components/FilterBar'
import { MobileTogglePill } from '@/components/MobileTogglePill'
import { useMapListings } from '@/hooks/useMapListings'
import { useLang } from '@/lib/i18n'
import type { AddressSuggestion } from '@/hooks/useAddressSearch'
import type { LayoutContext } from '@/App'
import { cn } from '@/lib/utils'

export function HomePage() {
  const { openPostModal, bounds, setBounds, filters, setFilters } = useOutletContext<LayoutContext>()
  const { t } = useLang()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'map'>('map')
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null)

  const { data: listings = [], isLoading } = useMapListings(bounds, filters)

  function handleAddressSelect(suggestion: AddressSuggestion) {
    setFlyTo({ lat: suggestion.lat, lng: suggestion.lng, zoom: 15 })
  }

  return (
    <div className="flex h-screen flex-col">
      <Header onOpenPostModal={openPostModal} />

      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onAddressSelect={handleAddressSelect}
        resultCount={listings.length}
      />

      <div className="relative flex flex-1 overflow-hidden px-3 pb-3 sm:gap-3">
        <aside
          className={cn(
            'w-full shrink-0 overflow-y-auto sm:block sm:w-[400px]',
            mobileView === 'list' ? 'block' : 'hidden',
          )}
        >
          {isLoading && listings.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">{t('home.loading')}</p>
          )}
          {!isLoading && listings.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">{t('home.empty')}</p>
          )}
          <div className="flex flex-col gap-3 pb-3">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isSelected={listing.id === selectedId}
                onSelect={(l) => navigate(`/listing/${l.id}`)}
              />
            ))}
          </div>
        </aside>

        <main
          className={cn(
            'relative isolate flex-1 overflow-hidden rounded-[28px]',
            mobileView === 'map' ? 'block' : 'hidden sm:block',
          )}
        >
          <MapView
            listings={listings}
            selectedId={selectedId}
            onBoundsChange={setBounds}
            onMarkerClick={(l) => setSelectedId(l.id)}
            flyTo={flyTo}
          />
        </main>
      </div>

      <MobileTogglePill view={mobileView} onChange={setMobileView} />
    </div>
  )
}
