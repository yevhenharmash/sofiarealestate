export type ListingType = 'room' | 'flat' | 'house'
export type ListingStatus = 'active' | 'draft' | 'expired'
export type ListingSource = 'user' | 'imotbg'
export type LocationPrecision = 'exact' | 'approximate'

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
  createdAt: string
  source: ListingSource
  sourceUrl: string | null
  locationPrecision: LocationPrecision
}

export interface OwnedListing {
  id: string
  title: string
  description: string | null
  price: number
  type: ListingType
  phone: string
  images: string[]
  status: ListingStatus
  lat: number
  lng: number
  createdAt: string
}

// What map pins/popups actually render — satisfied by both Listing and
// OwnedListing, so MapView can show either without depending on
// imotbg-specific fields that only OwnedListing lacks.
export type MapListing = Pick<Listing, 'id' | 'title' | 'price' | 'type' | 'lat' | 'lng' | 'images'>

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

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  phone_numbers: string[]
  created_at: string
}
