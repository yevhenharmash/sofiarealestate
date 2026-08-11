import { Slider } from '@/components/ui/slider'
import type { AddressSuggestion } from '@/hooks/useAddressSearch'
import { useListingTypeLabels } from '@/hooks/useListingTypeLabels'
import { useLang } from '@/lib/i18n'
import type { ListingFilters, ListingType } from '@/lib/types'
import { cn } from '@/lib/utils'

export const MAX_PRICE_CEILING = 3000

interface FilterBarProps {
  filters: ListingFilters
  onFiltersChange: (filters: ListingFilters) => void
  onAddressSelect: (suggestion: AddressSuggestion) => void
  resultCount: number
}

export function FilterBar({ filters, onFiltersChange, resultCount }: FilterBarProps) {
  const { t } = useLang()
  const typeLabels = useListingTypeLabels()

  const typeOptions: { value: ListingType | 'all'; label: string }[] = [
    { value: 'room', label: typeLabels.room },
    { value: 'flat', label: typeLabels.flat },
    { value: 'house', label: typeLabels.house },
    { value: 'all', label: t('filter.typeAll') },
  ]

  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
      {/* Address search — disabled for now, revisiting the UX.
      <div ref={searchRef} className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={t('filter.searchPlaceholder')}
          className="h-[42px] w-full rounded-full border-none bg-card pl-10 pr-9 text-sm shadow-[var(--shadow-sm)] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
        />
        {query && (
          <button
            type="button"
            aria-label={t('filter.clearSearch')}
            onClick={() => setQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {showDropdown && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-2xl bg-popover text-popover-foreground shadow-[var(--shadow-md)]">
            {isLoading && (
              <div className="px-3 py-2 text-sm text-muted-foreground">{t('filter.searching')}</div>
            )}
            {!isLoading && suggestions.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">{t('filter.noMatches')}</div>
            )}
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(s)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="line-clamp-2">{s.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      */}

      <div className="flex items-center gap-3 rounded-full bg-card px-4 py-2 shadow-[var(--shadow-sm)]">
        <span className="flex w-28 shrink-0 items-baseline justify-start gap-1 whitespace-nowrap text-sm font-semibold">
          {filters.maxPrice === undefined ? (
            t('filter.priceShowAll')
          ) : (
            <>
              {t('filter.priceUpToPrefix')}
              <span className="inline-block w-10 text-right tabular-nums">{filters.maxPrice}</span>
              €
            </>
          )}
        </span>
        <Slider
          className="w-24"
          min={0}
          max={MAX_PRICE_CEILING}
          step={50}
          value={[filters.maxPrice ?? MAX_PRICE_CEILING]}
          onValueChange={([value]) =>
            onFiltersChange({
              ...filters,
              maxPrice: value >= MAX_PRICE_CEILING ? undefined : value,
            })
          }
        />
      </div>

      <div className="flex items-center gap-1 rounded-full bg-card p-1 shadow-[var(--shadow-sm)]">
        {typeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() =>
              onFiltersChange({
                ...filters,
                type: option.value === 'all' ? undefined : option.value,
              })
            }
            className={cn(
              'whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-colors',
              (filters.type ?? 'all') === option.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <span className="whitespace-nowrap text-sm text-muted-foreground sm:ml-auto">
        {t('home.count', { count: resultCount })}
      </span>
    </div>
  )
}
