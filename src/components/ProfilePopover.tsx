import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLang } from '@/lib/i18n'
import { useAuth } from '@/lib/AuthProvider'
import { supabase } from '@/lib/supabaseClient'
import { isValidBulgarianMobile, normalizePhone } from '@/lib/phone'

export function ProfilePopover() {
  const { t } = useLang()
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const [newPhone, setNewPhone] = useState('')

  if (!user) return null

  const phoneNumbers = profile?.phone_numbers ?? []
  const initial = profile?.full_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? '?'

  async function updatePhoneNumbers(next: string[]) {
    const { error } = await supabase.from('profiles').update({ phone_numbers: next }).eq('id', user!.id)
    if (error) {
      toast.error(t('postModal.errorGeneric'))
      return
    }
    queryClient.invalidateQueries({ queryKey: ['profile', user!.id] })
  }

  function addPhone() {
    const normalized = normalizePhone(newPhone)
    if (!isValidBulgarianMobile(normalized)) {
      toast.error(t('postModal.errorPhoneInvalid'))
      return
    }
    if (phoneNumbers.includes(normalized)) {
      toast.error(t('postModal.errorPhoneInvalid'))
      return
    }
    updatePhoneNumbers([...phoneNumbers, normalized])
    setNewPhone('')
  }

  function removePhone(phone: string) {
    updatePhoneNumbers(phoneNumbers.filter((p) => p !== phone))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="rounded-full">
          <Avatar>
            <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.full_name ?? ''} />
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.full_name ?? ''} />
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{profile?.full_name}</span>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t('auth.phoneNumbers')}</p>
          {phoneNumbers.map((phone) => (
            <div key={phone} className="flex items-center justify-between gap-2">
              <span className="text-sm">{phone}</span>
              <button
                type="button"
                onClick={() => removePhone(phone)}
                aria-label={t('auth.removePhone')}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder={t('auth.phonePlaceholder')}
              className="h-8"
            />
            <Button type="button" size="sm" variant="outline" onClick={addPhone}>
              <Plus className="h-3.5 w-3.5" />
              {t('auth.addPhone')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
