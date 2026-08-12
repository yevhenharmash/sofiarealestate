import type { SVGProps } from 'react'
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

function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...props}>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
      />
    </svg>
  )
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
      <DialogContent className="gap-7 p-8 sm:max-w-[400px] sm:p-10">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-base text-primary-foreground">
            {t('header.brand').charAt(0)}
          </span>
          <span className="font-heading text-lg">{t('header.brand')}</span>
        </div>

        <DialogHeader className="gap-2 text-left">
          <DialogTitle className="font-heading text-3xl leading-tight font-normal">
            {t('auth.signInTitle')}
          </DialogTitle>
          <DialogDescription className="text-[15px]">
            {t('auth.signInDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Button onClick={handleContinue} className="h-12 gap-3 rounded-full text-base">
            <GoogleIcon className="size-5" />
            {t('auth.continueWithGoogle')}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{t('auth.firstTimeHint')}</p>
        </div>

        <div className="border-t pt-4 text-center">
          <p className="mb-3 text-xs text-muted-foreground">{t('auth.termsPrefix')}</p>
          <a href="#" className="text-xs font-semibold text-primary hover:underline">
            {t('auth.termsLinkText')}
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
