import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Toaster } from 'sonner'
import { MapView } from '@/components/MapView'
import { ListingCard } from '@/components/ListingCard'
import { FilterBar } from '@/components/FilterBar'
import { PostModal } from '@/components/PostModal'
import { MobileTogglePill } from '@/components/MobileTogglePill'
import { Button } from '@/components/ui/button'
import { useMapListings } from '@/hooks/useMapListings'
import type { AddressSuggestion } from '@/hooks/useAddressSearch'
import type { ListingFilters, MapBounds } from '@/lib/types'
import { cn } from '@/lib/utils'

function App() {
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const [filters, setFilters] = useState<ListingFilters>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'map'>('map')
  const [isPostModalOpen, setIsPostModalOpen] = useState(false)
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null)

  const { data: listings = [], isLoading } = useMapListings(bounds, filters)

  function handleAddressSelect(suggestion: AddressSuggestion) {
    setFlyTo({ lat: suggestion.lat, lng: suggestion.lng, zoom: 15 })
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-3 border-b bg-card px-4 py-2.5">
        <h1 className="text-base font-semibold">Имоти BG</h1>
        <Button size="sm" onClick={() => setIsPostModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Post a listing
        </Button>
      </header>

      <FilterBar filters={filters} onFiltersChange={setFilters} onAddressSelect={handleAddressSelect} />

      <div className="relative flex flex-1 overflow-hidden">
        <aside
          className={cn(
            'w-full shrink-0 overflow-y-auto sm:block sm:w-[380px]',
            mobileView === 'list' ? 'block' : 'hidden',
          )}
        >
          {isLoading && listings.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Loading listings…</p>
          )}
          {!isLoading && listings.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              No listings in this area. Try zooming out or adjusting filters.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isSelected={listing.id === selectedId}
                onSelect={(l) => {
                  setSelectedId(l.id)
                  setFlyTo({ lat: l.lat, lng: l.lng, zoom: 16 })
                  setMobileView('map')
                }}
              />
            ))}
          </div>
        </aside>

        <main
          className={cn('relative isolate flex-1', mobileView === 'map' ? 'block' : 'hidden sm:block')}
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
      <PostModal open={isPostModalOpen} onOpenChange={setIsPostModalOpen} />
      <Toaster position="top-center" richColors />
    </div>
  )
}

export default App
