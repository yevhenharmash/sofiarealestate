import { List, Map as MapIcon } from 'lucide-react'
import { useLang } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface MobileTogglePillProps {
  view: 'list' | 'map'
  onChange: (view: 'list' | 'map') => void
}

export function MobileTogglePill({ view, onChange }: MobileTogglePillProps) {
  const { t } = useLang()

  return (
    <div className="fixed bottom-5 left-1/2 z-[1000] flex -translate-x-1/2 rounded-full bg-card p-1 shadow-[var(--shadow-lg)] sm:hidden">
      <button
        type="button"
        onClick={() => onChange('list')}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors',
          view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
        )}
      >
        <List className="h-4 w-4" />
        {t('toggle.list')}
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
        {t('toggle.map')}
      </button>
    </div>
  )
}
