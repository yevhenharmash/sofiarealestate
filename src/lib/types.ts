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
  createdAt: string
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

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  phone_numbers: string[]
  created_at: string
}
