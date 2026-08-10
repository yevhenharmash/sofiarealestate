import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import type { Listing, MapBounds } from '@/lib/types'
import { LISTING_TYPE_LABELS } from '@/lib/types'
import { DEFAULT_MAP_ZOOM, SOFIA_CENTER } from '@/lib/constants'

const BOUNDS_DEBOUNCE_MS = 300

function formatPrice(price: number): string {
  if (price >= 1000) return `${Math.round(price / 100) / 10}k €`
  return `${price} €`
}

function buildMarkerIcon(listing: Listing, isSelected: boolean): L.DivIcon {
  return L.divIcon({
    className: 'listing-marker-icon',
    html: `<div class="${
      isSelected
        ? 'bg-primary text-primary-foreground'
        : 'bg-card text-card-foreground'
    } border border-border shadow-md rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap -translate-x-1/2 -translate-y-1/2">${formatPrice(
      listing.price,
    )}</div>`,
    iconSize: [0, 0],
  })
}

function clusterIcon(cluster: { getChildCount: () => number }) {
  const count = cluster.getChildCount()
  const size = count < 10 ? 34 : count < 50 ? 42 : 50
  return L.divIcon({
    html: `<div class="marker-cluster-custom" style="width:${size}px;height:${size}px">${count}</div>`,
    className: '',
    iconSize: L.point(size, size, true),
  })
}

function boundsToMapBounds(bounds: L.LatLngBounds): MapBounds {
  return {
    minLng: bounds.getWest(),
    minLat: bounds.getSouth(),
    maxLng: bounds.getEast(),
    maxLat: bounds.getNorth(),
  }
}

function BoundsWatcher({ onBoundsChange }: { onBoundsChange: (bounds: MapBounds) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const map = useMapEvents({
    moveend: () => scheduleUpdate(),
    zoomend: () => scheduleUpdate(),
  })

  function scheduleUpdate() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onBoundsChange(boundsToMapBounds(map.getBounds()))
    }, BOUNDS_DEBOUNCE_MS)
  }

  useEffect(() => {
    onBoundsChange(boundsToMapBounds(map.getBounds()))
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

function FlyToHandler({ target }: { target: { lat: number; lng: number; zoom?: number } | null }) {
  const map = useMap()

  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom ?? 15)
  }, [target, map])

  return null
}

interface MapViewProps {
  listings: Listing[]
  selectedId?: string | null
  onBoundsChange: (bounds: MapBounds) => void
  onMarkerClick?: (listing: Listing) => void
  flyTo?: { lat: number; lng: number; zoom?: number } | null
}

export function MapView({ listings, selectedId, onBoundsChange, onMarkerClick, flyTo }: MapViewProps) {
  const markers = useMemo(
    () =>
      listings.map((listing) => (
        <Marker
          key={listing.id}
          position={[listing.lat, listing.lng]}
          icon={buildMarkerIcon(listing, listing.id === selectedId)}
          eventHandlers={{
            click: () => onMarkerClick?.(listing),
          }}
        >
          <Popup>
            <div className="text-sm font-medium">{listing.title}</div>
            <div className="text-xs text-muted-foreground">
              {LISTING_TYPE_LABELS[listing.type]} · {formatPrice(listing.price)}
            </div>
          </Popup>
        </Marker>
      )),
    [listings, selectedId, onMarkerClick],
  )

  return (
    <MapContainer
      center={SOFIA_CENTER}
      zoom={DEFAULT_MAP_ZOOM}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <BoundsWatcher onBoundsChange={onBoundsChange} />
      <FlyToHandler target={flyTo ?? null} />
      <MarkerClusterGroup chunkedLoading iconCreateFunction={clusterIcon}>
        {markers}
      </MarkerClusterGroup>
    </MapContainer>
  )
}
