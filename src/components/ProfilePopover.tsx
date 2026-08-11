import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Camera, Phone, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLang } from '@/lib/i18n'
import { useAuth } from '@/lib/AuthProvider'
import { supabase } from '@/lib/supabaseClient'
import { isValidMobilePhone, normalizePhone } from '@/lib/phone'
import { cn } from '@/lib/utils'

export function ProfilePopover() {
  const { t } = useLang()
  const { user, profile, signOut } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phones, setPhones] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(profile?.full_name ?? '')
    setPhones(profile?.phone_numbers ?? [])
  }, [open, profile])

  if (!user) return null

  const initial = profile?.full_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? '?'

  function updatePhone(index: number, value: string) {
    setPhones((prev) => prev.map((p, i) => (i === index ? value : p)))
  }

  function removePhone(index: number) {
    setPhones((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    const normalized = phones.map(normalizePhone).filter(Boolean)
    const invalid = normalized.find((p) => !isValidMobilePhone(p))
    if (invalid) {
      toast.error(t('postModal.errorPhoneInvalid'))
      return
    }

    setIsSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() || null, phone_numbers: normalized })
      .eq('id', user!.id)
    setIsSaving(false)

    if (error) {
      toast.error(t('postModal.errorGeneric'))
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['profile', user!.id] })
    toast.success(t('profile.saved'))
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        className="rounded-full"
        onClick={() => setOpen(true)}
        aria-label={t('profile.title')}
      >
        <Avatar>
          <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.full_name ?? ''} />
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </button>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('profile.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <button
            type="button"
            title={t('profile.changePhoto')}
            onClick={() => toast(t('profile.photoUploadUnavailable'))}
            className="group relative shrink-0"
          >
            <Avatar size="lg" className="size-24">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.full_name ?? ''} />
              <AvatarFallback className="text-3xl">{initial}</AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-6 w-6" />
            </span>
            <AvatarBadge className="size-7 bg-card text-primary ring-2 ring-card">
              <Camera className="h-3.5 w-3.5" />
            </AvatarBadge>
          </button>
          <div className="min-w-0">
            <p className="truncate font-heading text-base">{profile?.full_name || user.email}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <p className="mt-1 text-xs font-semibold text-primary">{t('profile.changePhotoHint')}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-name">{t('profile.name')}</Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('profile.namePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t('auth.phoneNumbers')}</p>
          {phones.map((phone, i) => (
            <div key={i} className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2">
              <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => updatePhone(i, e.target.value)}
                placeholder={t('auth.phonePlaceholder')}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => removePhone(i)}
                aria-label={t('auth.removePhone')}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPhones((prev) => [...prev, ''])}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-3 py-2 text-sm font-semibold text-primary transition-colors',
              'hover:bg-primary/5',
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('profile.addPhone')}
          </button>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              signOut()
            }}
            className="text-xs font-semibold text-destructive hover:text-destructive/80"
          >
            {t('profile.signOut')}
          </button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('profile.cancel')}
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {t('profile.save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
