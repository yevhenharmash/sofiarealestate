import { useSessionStorage } from 'usehooks-ts'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useLang } from '@/lib/i18n'
import { useAuth, POST_INTENT_KEY } from '@/lib/AuthProvider'

interface SignInModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  postIntent?: boolean
}

export function SignInModal({ open, onOpenChange, postIntent }: SignInModalProps) {
  const { t } = useLang()
  const { signInWithGoogle } = useAuth()
  const [, setPostIntent] = useSessionStorage(POST_INTENT_KEY, false)

  function handleContinue() {
    if (postIntent) setPostIntent(true)
    signInWithGoogle()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('auth.signInTitle')}</DialogTitle>
          <DialogDescription>{t('auth.signInDescription')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button onClick={handleContinue}>{t('auth.continueWithGoogle')}</Button>
          <p className="text-center text-xs text-muted-foreground">{t('auth.firstTimeHint')}</p>
        </div>

        <div className="border-t pt-3 text-center">
          <p className="mb-1.5 text-xs text-muted-foreground">{t('auth.termsPrefix')}</p>
          <a href="#" className="text-xs font-semibold text-primary hover:underline">
            {t('auth.termsLinkText')}
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
