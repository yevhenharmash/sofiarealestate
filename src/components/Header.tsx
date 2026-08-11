import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLang, type Lang } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthProvider'
import { SignInModal } from '@/components/SignInModal'
import { ProfilePopover } from '@/components/ProfilePopover'

interface HeaderProps {
  onOpenPostModal: () => void
}

export function Header({ onOpenPostModal }: HeaderProps) {
  const { lang, setLang, t } = useLang()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isSignInOpen, setIsSignInOpen] = useState(false)
  const [signInPostIntent, setSignInPostIntent] = useState(false)

  function handlePostListingClick() {
    if (!user) {
      setSignInPostIntent(true)
      setIsSignInOpen(true)
      return
    }
    onOpenPostModal()
  }

  function handleMyListingsClick() {
    if (!user) {
      setSignInPostIntent(false)
      setIsSignInOpen(true)
      return
    }
    navigate('/my-listings')
  }

  function handleFavouritesClick() {
    if (!user) {
      setSignInPostIntent(false)
      setIsSignInOpen(true)
      return
    }
    navigate('/favourites')
  }

  return (
    <header className="flex items-center justify-between gap-3 bg-card px-4 py-3 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="font-heading text-lg">{t('header.brand')}</span>
        </Link>

        <div className="hidden items-center gap-1 rounded-full bg-muted p-1 sm:flex">
          {(['bg', 'en'] as Lang[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setLang(option)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-bold uppercase transition-colors',
                lang === option
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Button className="rounded-full" onClick={handlePostListingClick}>
          <Plus className="h-4 w-4" />
          {t('header.postListing')}
        </Button>

        <Button
          variant="outline"
          className="hidden rounded-full sm:inline-flex"
          onClick={handleMyListingsClick}
        >
          {t('header.myListings')}
        </Button>

        <Button
          variant="outline"
          className="hidden rounded-full sm:inline-flex"
          onClick={handleFavouritesClick}
        >
          {t('header.favourites')}
        </Button>

        {user ? (
          <ProfilePopover />
        ) : (
          <button
            type="button"
            onClick={() => {
              setSignInPostIntent(false)
              setIsSignInOpen(true)
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
            aria-label={t('auth.continueWithGoogle')}
          >
            <User className="h-4 w-4" />
          </button>
        )}
      </div>

      <SignInModal open={isSignInOpen} onOpenChange={setIsSignInOpen} postIntent={signInPostIntent} />
    </header>
  )
}
