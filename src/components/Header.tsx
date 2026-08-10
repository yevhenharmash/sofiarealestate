import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLang, type Lang } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface HeaderProps {
  onOpenPostModal: () => void
}

export function Header({ onOpenPostModal }: HeaderProps) {
  const { lang, setLang, t } = useLang()

  return (
    <header className="flex items-center justify-between gap-3 bg-card px-4 py-3 shadow-[var(--shadow-sm)]">
      <Link to="/" className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-base text-primary-foreground">
          {t('header.logoInitial')}
        </span>
        <span className="font-heading text-lg">{t('header.brand')}</span>
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-1 rounded-full bg-muted p-1 sm:flex">
          {(['bg', 'en'] as Lang[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setLang(option)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-bold uppercase transition-colors',
                lang === option
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="hidden rounded-full sm:inline-flex"
          aria-disabled="true"
        >
          {t('header.myListings')}
        </Button>

        <Button size="sm" className="rounded-full" onClick={onOpenPostModal}>
          <Plus className="h-4 w-4" />
          {t('header.postListing')}
        </Button>
      </div>
    </header>
  )
}
