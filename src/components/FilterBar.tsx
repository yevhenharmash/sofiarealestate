import { useState } from 'react'
import { MapPin, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAddressSearch, type AddressSuggestion } from '@/hooks/useAddressSearch'
import type { ListingFilters, ListingType } from '@/lib/types'
import { LISTING_TYPE_LABELS } from '@/lib/types'

export const MAX_PRICE_CEILING = 3000

interface FilterBarProps {
  filters: ListingFilters
  onFiltersChange: (filters: ListingFilters) => void
  onAddressSelect: (suggestion: AddressSuggestion) => void
}

export function FilterBar({ filters, onFiltersChange, onAddressSelect }: FilterBarProps) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const { suggestions, isLoading } = useAddressSearch(query)

  function handleSelect(suggestion: AddressSuggestion) {
    onAddressSelect(suggestion)
    setQuery(suggestion.label)
    setIsFocused(false)
  }

  const showDropdown = isFocused && query.length >= 3 && (suggestions.length > 0 || isLoading)

  return (
    <div className="flex flex-col gap-3 border-b bg-card p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          placeholder="Search address or neighborhood…"
          className="pl-8 pr-8"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {showDropdown && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10">
            {isLoading && (
              <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>
            )}
            {!isLoading && suggestions.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No matches found.</div>
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

      <div className="flex items-center gap-3">
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          Max {filters.maxPrice != null ? `${filters.maxPrice} €` : 'any'}
        </span>
        <Slider
          className="w-36"
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

      <Select
        value={filters.type ?? 'all'}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, type: value === 'all' ? undefined : (value as ListingType) })
        }
      >
        <SelectTrigger className="w-full sm:w-32">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {Object.entries(LISTING_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
