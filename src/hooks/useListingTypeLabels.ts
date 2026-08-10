import { useLang } from '@/lib/i18n'
import type { ListingType } from '@/lib/types'

export function useListingTypeLabels(): Record<ListingType, string> {
  const { t } = useLang()
  return {
    room: t('filter.typeRoom'),
    flat: t('filter.typeFlat'),
    house: t('filter.typeHouse'),
  }
}
