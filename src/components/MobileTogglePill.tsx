import { List, Map as MapIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileTogglePillProps {
  view: 'list' | 'map'
  onChange: (view: 'list' | 'map') => void
}

export function MobileTogglePill({ view, onChange }: MobileTogglePillProps) {
  return (
    <div className="fixed bottom-5 left-1/2 z-[1000] flex -translate-x-1/2 rounded-full bg-card p-1 shadow-lg ring-1 ring-foreground/10 sm:hidden">
      <button
        type="button"
        onClick={() => onChange('list')}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors',
          view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
        )}
      >
        <List className="h-4 w-4" />
        List
      </button>
      <button
        type="button"
        onClick={() => onChange('map')}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors',
          view === 'map' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
        )}
      >
        <MapIcon className="h-4 w-4" />
        Map
      </button>
    </div>
  )
}
