import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { SOFIA_CENTER } from '@/lib/constants'

const pinIcon = L.divIcon({
  className: 'location-picker-pin',
  html: '<div class="h-6 w-6 -translate-x-1/2 -translate-y-full rounded-full bg-primary ring-4 ring-primary/30"></div>',
  iconSize: [0, 0],
})

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  })
  return null
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

interface LocationPickerProps {
  position: { lat: number; lng: number } | null
  onChange: (lat: number, lng: number) => void
}

export function LocationPicker({ position, onChange }: LocationPickerProps) {
  const center: [number, number] = position ? [position.lat, position.lng] : SOFIA_CENTER

  return (
    <div className="h-48 w-full overflow-hidden rounded-lg border">
      <MapContainer center={center} zoom={14} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter center={center} />
        <ClickHandler onPick={onChange} />
        {position && (
          <Marker
            position={[position.lat, position.lng]}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng()
                onChange(lat, lng)
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  )
}
