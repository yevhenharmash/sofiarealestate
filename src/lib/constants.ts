import type { ListingFilters, ListingType } from './types'

export const SOFIA_CENTER: [number, number] = [42.6977, 23.3219]
export const DEFAULT_MAP_ZOOM = 13

export const DEFAULT_MAX_PRICE = 1000
export const DEFAULT_LISTING_TYPE: ListingType = 'flat'

export const DEFAULT_LISTING_FILTERS: ListingFilters = {
  type: DEFAULT_LISTING_TYPE,
  maxPrice: DEFAULT_MAX_PRICE,
}

export const MAX_LISTING_IMAGES = 6
