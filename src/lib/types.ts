export type ListingType = 'room' | 'flat' | 'house'

export interface Listing {
  id: string
  title: string
  description: string | null
  price: number
  type: ListingType
  phone: string
  lat: number
  lng: number
  images: string[]
}

export interface MapBounds {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

export interface ListingFilters {
  maxPrice?: number
  type?: ListingType
}

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  room: 'Room',
  flat: 'Flat',
  house: 'House',
}
