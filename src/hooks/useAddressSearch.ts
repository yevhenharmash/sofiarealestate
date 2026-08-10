import { useEffect, useRef, useState } from 'react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

export interface AddressSuggestion {
  label: string
  lat: number
  lng: number
}

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search'
// Bias results towards Bulgaria without hard-excluding everything else.
const COUNTRY_CODES = 'bg'

export function useAddressSearch(query: string) {
  const debouncedQuery = useDebouncedValue(query.trim(), 400)
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (debouncedQuery.length < 3) {
      setSuggestions([])
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)

    const url = new URL(NOMINATIM_ENDPOINT)
    url.searchParams.set('q', debouncedQuery)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '5')
    url.searchParams.set('countrycodes', COUNTRY_CODES)
    url.searchParams.set('accept-language', 'bg,en')

    fetch(url.toString(), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Nominatim error: ${res.status}`)
        return res.json()
      })
      .then((results: Array<{ display_name: string; lat: string; lon: string }>) => {
        setSuggestions(
          results.map((r) => ({
            label: r.display_name,
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
          })),
        )
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setSuggestions([])
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [debouncedQuery])

  return { suggestions, isLoading }
}
