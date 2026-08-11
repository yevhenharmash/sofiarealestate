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
        <Button onClick={handleContinue}>{t('auth.continueWithGoogle')}</Button>
      </DialogContent>
    </Dialog>
  )
}
