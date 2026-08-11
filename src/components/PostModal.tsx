import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LocationPicker } from '@/components/LocationPicker'
import { useListingTypeLabels } from '@/hooks/useListingTypeLabels'
import { useLang } from '@/lib/i18n'
import { supabase } from '@/lib/supabaseClient'
import { uploadListingImages } from '@/lib/listingImages'
import { isValidMobilePhone, normalizePhone } from '@/lib/phone'
import { useAuth } from '@/lib/AuthProvider'
import type { ListingStatus, ListingType } from '@/lib/types'
import { SOFIA_CENTER, MAX_LISTING_IMAGES } from '@/lib/constants'

const MAX_IMAGES = MAX_LISTING_IMAGES

interface PostModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FormState = {
  title: string
  description: string
  price: string
  type: ListingType
  phone: string
  status: ListingStatus
}

const INITIAL_FORM: FormState = {
  title: '',
  description: '',
  price: '',
  type: 'flat',
  phone: '',
  status: 'active',
}

const STATUS_OPTIONS: ListingStatus[] = ['active', 'draft', 'expired']

const DEFAULT_POSITION = { lat: SOFIA_CENTER[0], lng: SOFIA_CENTER[1] }

// Sentinel select value — distinct from any real phone number, never
// submitted, just used to detect "the user picked the 'add new' row".
const NEW_PHONE_VALUE = '__new__'

export function PostModal({ open, onOpenChange }: PostModalProps) {
  const { t } = useLang()
  const typeLabels = useListingTypeLabels()
  const queryClient = useQueryClient()
  const { user, profile } = useAuth()
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [position, setPosition] = useState<{ lat: number; lng: number }>(DEFAULT_POSITION)
  const [files, setFiles] = useState<File[]>([])
  const [honeypot, setHoneypot] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [addingNewPhone, setAddingNewPhone] = useState(false)

  const savedPhones = profile?.phone_numbers ?? []
  const showPhoneSelect = savedPhones.length > 0 && !addingNewPhone

  useEffect(() => {
    if (open && savedPhones.length > 0) {
      setForm((prev) => (prev.phone ? prev : { ...prev, phone: savedPhones[0] }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function resetAndClose() {
    setForm(INITIAL_FORM)
    setPosition(DEFAULT_POSITION)
    setFiles([])
    setHoneypot('')
    setAddingNewPhone(false)
    onOpenChange(false)
  }

  function handlePhoneSelect(value: string) {
    if (value === NEW_PHONE_VALUE) {
      setAddingNewPhone(true)
      setForm((prev) => ({ ...prev, phone: '' }))
    } else {
      setForm((prev) => ({ ...prev, phone: value }))
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error(t('postModal.errorGeoUnsupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast.error(t('postModal.errorGeoDenied')),
    )
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    setFiles((prev) => [...prev, ...selected].slice(0, MAX_IMAGES))
    e.target.value = ''
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Honeypot: real users never fill this hidden field. Silently "succeed"
    // for bots instead of telling them what tripped the check.
    if (honeypot) {
      resetAndClose()
      return
    }

    // Defensive: Header gates opening this modal behind auth, but a session
    // could still expire mid-fill.
    if (!user) {
      toast.error(t('postModal.errorGeneric'))
      resetAndClose()
      return
    }

    if (!form.title.trim()) return toast.error(t('postModal.errorTitleRequired'))
    const price = Number(form.price)
    if (!form.price || Number.isNaN(price) || price <= 0) return toast.error(t('postModal.errorPriceInvalid'))
    if (!isValidMobilePhone(form.phone)) {
      return toast.error(t('postModal.errorPhoneInvalid'))
    }

    setIsSubmitting(true)
    try {
      const images = await uploadListingImages(files, user.id)

      const { error: insertError } = await supabase.from('listings').insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        price,
        type: form.type,
        phone: form.phone.trim(),
        status: form.status,
        images,
        location: `POINT(${position.lng} ${position.lat})`,
        user_id: user.id,
      })

      if (insertError) throw insertError

      // Best-effort: a brand-new phone number is saved to the profile so
      // it's available to pick from next time. Failure here shouldn't
      // surface as if posting the listing failed.
      const normalizedPhone = normalizePhone(form.phone.trim())
      const alreadySaved = savedPhones.some((p) => normalizePhone(p) === normalizedPhone)
      if (!alreadySaved) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ phone_numbers: [...savedPhones, normalizedPhone] })
          .eq('id', user.id)
        if (profileError) console.error('Failed to save new phone number to profile:', profileError)
        else await queryClient.invalidateQueries({ queryKey: ['profile', user.id] })
      }

      await queryClient.invalidateQueries({ queryKey: ['listings'] })
      await queryClient.invalidateQueries({ queryKey: ['my-listings'] })
      toast.success(t('postModal.successPosted'))
      resetAndClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('postModal.errorGeneric'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : resetAndClose())}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('postModal.title')}</DialogTitle>
          <DialogDescription>{t('postModal.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto py-0.5">
          {/* Honeypot — hidden from real users via CSS, bots fill every field they can find. */}
          <div className="absolute -left-[9999px]" aria-hidden="true">
            <label htmlFor="company">Company</label>
            <input
              id="company"
              name="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">{t('postModal.fieldTitle')}</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t('postModal.fieldTitlePlaceholder')}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">{t('postModal.fieldDescription')}</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('postModal.fieldDescriptionPlaceholder')}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price">{t('postModal.fieldPrice')}</Label>
              <Input
                id="price"
                type="number"
                min={0}
                inputMode="numeric"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="450"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">{t('postModal.fieldType')}</Label>
              <Select
                value={form.type}
                onValueChange={(value) => setForm({ ...form, type: value as ListingType })}
              >
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">{t('postModal.fieldStatus')}</Label>
            <Select
              value={form.status}
              onValueChange={(value) => setForm({ ...form, status: value as ListingStatus })}
            >
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`myListings.status${status[0].toUpperCase()}${status.slice(1)}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">{t('postModal.fieldPhone')}</Label>
            {showPhoneSelect ? (
              <Select value={form.phone} onValueChange={handlePhoneSelect}>
                <SelectTrigger id="phone" className="w-full">
                  <SelectValue placeholder="0888 123 456" />
                </SelectTrigger>
                <SelectContent>
                  {savedPhones.map((phone) => (
                    <SelectItem key={phone} value={phone}>
                      {phone}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_PHONE_VALUE}>{t('postModal.addNewPhone')}</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-1">
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0888 123 456"
                  required
                />
                {savedPhones.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingNewPhone(false)
                      setForm((prev) => ({ ...prev, phone: savedPhones[0] }))
                    }}
                    className="text-xs font-semibold text-primary"
                  >
                    {t('postModal.useSavedPhone')}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{t('postModal.location')}</Label>
              <Button type="button" variant="ghost" size="sm" onClick={useMyLocation}>
                {t('postModal.useMyLocation')}
              </Button>
            </div>
            <LocationPicker position={position} onChange={(lat, lng) => setPosition({ lat, lng })} />
            <p className="text-xs text-muted-foreground">{t('postModal.locationHint')}</p>
          </div>

          <div className="space-y-1.5">
            <Label>{t('postModal.photos')}</Label>
            <div className="flex flex-wrap gap-2">
              {files.map((file, i) => (
                <div key={i} className="relative h-16 w-16 overflow-hidden rounded-md border">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {files.length < MAX_IMAGES && (
                <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                  <Upload className="h-5 w-5" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFilesSelected}
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('postModal.photosHint', { max: MAX_IMAGES })}
            </p>
          </div>
        </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose}>
              {t('postModal.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? t('postModal.submitting') : t('postModal.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
