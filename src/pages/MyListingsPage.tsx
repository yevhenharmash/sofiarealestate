import { useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ImageOff, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Header } from '@/components/Header'
import { ListingImage } from '@/components/ListingImage'
import { LocationPicker } from '@/components/LocationPicker'
import { MapView } from '@/components/MapView'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMyListings } from '@/hooks/useMyListings'
import { useListingTypeLabels } from '@/hooks/useListingTypeLabels'
import { useAuth } from '@/lib/AuthProvider'
import { useLang } from '@/lib/i18n'
import { supabase } from '@/lib/supabaseClient'
import { deleteListingImages, uploadListingImages } from '@/lib/listingImages'
import { isValidMobilePhone, normalizePhone } from '@/lib/phone'
import { MAX_LISTING_IMAGES } from '@/lib/constants'
import type { ListingStatus, ListingType, OwnedListing } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { LayoutContext } from '@/App'

const STATUS_ORDER: ListingStatus[] = ['active', 'draft', 'expired']

const STATUS_CLASS: Record<ListingStatus, string> = {
  active: 'bg-secondary text-secondary-foreground',
  draft: 'bg-muted text-muted-foreground',
  expired: 'bg-destructive/10 text-destructive',
}

// Sentinel select value — distinct from any real phone number, never
// submitted, just used to detect "the user picked the 'add new' row".
// Mirrors the same pattern in PostModal.tsx.
const NEW_EDIT_PHONE_VALUE = '__new__'

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(price) + ' €'
}

type Filter = 'all' | ListingStatus

export function MyListingsPage() {
  const { openPostModal } = useOutletContext<LayoutContext>()
  const { t } = useLang()
  const navigate = useNavigate()
  const typeLabels = useListingTypeLabels()
  const queryClient = useQueryClient()
  const { user, profile } = useAuth()

  const { data: listings = [], isLoading } = useMyListings(user?.id)
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<OwnedListing | null>(null)
  const [deleting, setDeleting] = useState<OwnedListing | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    price: '',
    description: '',
    type: 'flat' as ListingType,
    status: 'active' as ListingStatus,
    phone: '',
  })
  const [editPosition, setEditPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [removedImages, setRemovedImages] = useState<string[]>([])
  const [newImageFiles, setNewImageFiles] = useState<File[]>([])
  const [addingNewEditPhone, setAddingNewEditPhone] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const savedPhones = profile?.phone_numbers ?? []
  const showEditPhoneSelect = savedPhones.length > 0 && !addingNewEditPhone

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: listings.length, active: 0, draft: 0, expired: 0 }
    for (const listing of listings) result[listing.status] += 1
    return result
  }, [listings])

  const visible = filter === 'all' ? listings : listings.filter((l) => l.status === filter)

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ['my-listings'] })
    await queryClient.invalidateQueries({ queryKey: ['listings'] })
  }

  async function changeStatus(listing: OwnedListing, next: ListingStatus) {
    if (next === listing.status) return
    const { error } = await supabase.from('listings').update({ status: next }).eq('id', listing.id)
    if (error) return toast.error(error.message)
    await invalidate()
  }

  function openEdit(listing: OwnedListing) {
    setEditing(listing)
    setEditForm({
      title: listing.title,
      price: String(listing.price),
      description: listing.description ?? '',
      type: listing.type,
      status: listing.status,
      phone: listing.phone,
    })
    setEditPosition({ lat: listing.lat, lng: listing.lng })
    setExistingImages(listing.images)
    setRemovedImages([])
    setNewImageFiles([])
    setAddingNewEditPhone(false)
  }

  function handleEditPhoneSelect(value: string) {
    if (value === NEW_EDIT_PHONE_VALUE) {
      setAddingNewEditPhone(true)
      setEditForm((prev) => ({ ...prev, phone: '' }))
    } else {
      setEditForm((prev) => ({ ...prev, phone: value }))
    }
  }

  function useMyLocationForEdit() {
    if (!navigator.geolocation) {
      toast.error(t('postModal.errorGeoUnsupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setEditPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast.error(t('postModal.errorGeoDenied')),
    )
  }

  const editImageCount = existingImages.length + newImageFiles.length

  function removeExistingImage(url: string) {
    setExistingImages((prev) => prev.filter((u) => u !== url))
    setRemovedImages((prev) => [...prev, url])
  }

  function addImageFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    setNewImageFiles((prev) => [...prev, ...selected].slice(0, MAX_LISTING_IMAGES - existingImages.length))
    e.target.value = ''
  }

  function removeNewImageFile(index: number) {
    setNewImageFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function saveEdit() {
    if (!editing || !user || !editPosition) return
    const price = Number(editForm.price)
    if (!editForm.title.trim() || !editForm.price || Number.isNaN(price) || price <= 0) return
    if (!isValidMobilePhone(editForm.phone)) {
      toast.error(t('postModal.errorPhoneInvalid'))
      return
    }

    setIsSaving(true)
    try {
      const uploaded = await uploadListingImages(newImageFiles, user.id)
      const images = [...existingImages, ...uploaded]

      const { error } = await supabase
        .from('listings')
        .update({
          title: editForm.title.trim(),
          price,
          description: editForm.description.trim() || null,
          type: editForm.type,
          status: editForm.status,
          phone: editForm.phone.trim(),
          location: `POINT(${editPosition.lng} ${editPosition.lat})`,
          images,
        })
        .eq('id', editing.id)
      if (error) throw error

      if (removedImages.length > 0) await deleteListingImages(removedImages)

      // Best-effort, same as PostModal: a brand-new phone number is saved to
      // the profile so it's available to pick from next time.
      const normalizedPhone = normalizePhone(editForm.phone.trim())
      const alreadySaved = savedPhones.some((p) => normalizePhone(p) === normalizedPhone)
      if (!alreadySaved) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ phone_numbers: [...savedPhones, normalizedPhone] })
          .eq('id', user.id)
        if (profileError) console.error('Failed to save new phone number to profile:', profileError)
        else await queryClient.invalidateQueries({ queryKey: ['profile', user.id] })
      }

      toast.success(t('myListings.updated'))
      setEditing(null)
      await invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('postModal.errorGeneric'))
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    const { error } = await supabase.from('listings').delete().eq('id', deleting.id)
    if (error) return toast.error(error.message)
    if (deleting.images.length > 0) await deleteListingImages(deleting.images)
    toast.success(t('myListings.deleted'))
    setDeleting(null)
    await invalidate()
  }

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: t('myListings.filterAll', { count: counts.all }) },
    { value: 'active', label: t('myListings.filterActive', { count: counts.active }) },
    { value: 'draft', label: t('myListings.filterDraft', { count: counts.draft }) },
    { value: 'expired', label: t('myListings.filterExpired', { count: counts.expired }) },
  ]

  return (
    <div className="flex h-screen flex-col">
      <Header onOpenPostModal={openPostModal} />

      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        <div className="flex-1 overflow-y-auto">
          <Link
            to="/"
            className="mb-3 flex items-center gap-1.5 text-sm font-bold text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('myListings.back')}
          </Link>

          <div className="mb-6 flex items-start justify-between gap-4">
            <h1 className="font-heading text-3xl">{t('myListings.title')}</h1>
            <Button className="rounded-full bg-primary hover:bg-primary-hover" onClick={openPostModal}>
              {t('header.postListing')}
            </Button>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                  filter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">{t('myListings.loading')}</p>}

          {!isLoading && visible.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <h3 className="text-xl font-bold">{t('myListings.emptyTitle')}</h3>
              <p className="max-w-sm text-sm text-muted-foreground">{t('myListings.emptyText')}</p>
              <Button className="mt-2 rounded-full bg-primary hover:bg-primary-hover" onClick={openPostModal}>
                {t('header.postListing')}
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {visible.map((listing) => (
              <div
                key={listing.id}
                className="flex gap-3 rounded-[26px] bg-card p-3 shadow-[var(--shadow-sm)]"
              >
                <div className="relative h-[124px] w-[136px] shrink-0 overflow-hidden rounded-[20px] bg-muted">
                  {listing.images.length > 0 ? (
                    <ListingImage
                      src={listing.images[0]}
                      alt={listing.title}
                      className="h-full w-full cursor-pointer object-cover"
                      onClick={() => navigate(`/listing/${listing.id}`)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageOff className="h-6 w-6" />
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-heading text-2xl leading-none text-price">
                      {formatPrice(listing.price)}
                    </span>
                    <Select
                      value={listing.status}
                      onValueChange={(value) => changeStatus(listing, value as ListingStatus)}
                    >
                      <SelectTrigger
                        size="sm"
                        className={cn(
                          'ml-auto h-auto rounded-full border-none px-3 py-1 text-xs font-semibold',
                          STATUS_CLASS[listing.status],
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_ORDER.map((status) => (
                          <SelectItem key={status} value={status}>
                            {t(`myListings.status${status[0].toUpperCase()}${status.slice(1)}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <h3 className="line-clamp-2 text-sm font-bold leading-snug text-pretty">{listing.title}</h3>
                  <div>
                    <Badge className="h-6 rounded-full bg-secondary px-3 text-secondary-foreground">
                      {typeLabels[listing.type]}
                    </Badge>
                  </div>
                  <div className="mt-auto flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(listing)}>
                      {t('myListings.edit')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label={t('myListings.deleteAria')}
                      onClick={() => setDeleting(listing)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative isolate hidden w-[380px] shrink-0 overflow-hidden rounded-[28px] lg:block">
          <MapView listings={visible} onMarkerClick={(l) => navigate(`/listing/${l.id}`)} />
        </div>
      </div>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('myListings.deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('myListings.deleteConfirmText')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('profile.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t('myListings.deleteConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('myListings.editTitle')}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-4 overflow-y-auto py-0.5">
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">{t('postModal.fieldTitle')}</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-description">{t('postModal.fieldDescription')}</Label>
              <Textarea
                id="edit-description"
                rows={4}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('postModal.photos')}</Label>
              <div className="flex flex-wrap gap-2">
                {existingImages.map((url) => (
                  <div key={url} className="relative h-16 w-16 overflow-hidden rounded-md border">
                    <ListingImage src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeExistingImage(url)}
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {newImageFiles.map((file, i) => (
                  <div key={i} className="relative h-16 w-16 overflow-hidden rounded-md border">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeNewImageFile(i)}
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {editImageCount < MAX_LISTING_IMAGES && (
                  <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                    <Upload className="h-5 w-5" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={addImageFiles}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-price">{t('postModal.fieldPrice')}</Label>
                <Input
                  id="edit-price"
                  type="number"
                  min={0}
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-type">{t('postModal.fieldType')}</Label>
                <Select
                  value={editForm.type}
                  onValueChange={(value) => setEditForm({ ...editForm, type: value as ListingType })}
                >
                  <SelectTrigger id="edit-type" className="w-full">
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
              <Label htmlFor="edit-status">{t('postModal.fieldStatus')}</Label>
              <Select
                value={editForm.status}
                onValueChange={(value) => setEditForm({ ...editForm, status: value as ListingStatus })}
              >
                <SelectTrigger id="edit-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`myListings.status${status[0].toUpperCase()}${status.slice(1)}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">{t('postModal.fieldPhone')}</Label>
              {showEditPhoneSelect ? (
                <Select value={editForm.phone} onValueChange={handleEditPhoneSelect}>
                  <SelectTrigger id="edit-phone" className="w-full">
                    <SelectValue placeholder="0888 123 456" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedPhones.map((phone) => (
                      <SelectItem key={phone} value={phone}>
                        {phone}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_EDIT_PHONE_VALUE}>{t('postModal.addNewPhone')}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-1">
                  <Input
                    id="edit-phone"
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="0888 123 456"
                  />
                  {savedPhones.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAddingNewEditPhone(false)
                        setEditForm((prev) => ({ ...prev, phone: savedPhones[0] }))
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
                <Button type="button" variant="ghost" size="sm" onClick={useMyLocationForEdit}>
                  {t('postModal.useMyLocation')}
                </Button>
              </div>
              <LocationPicker position={editPosition} onChange={(lat, lng) => setEditPosition({ lat, lng })} />
              <p className="text-xs text-muted-foreground">{t('postModal.locationHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t('profile.cancel')}
            </Button>
            <Button onClick={saveEdit} disabled={isSaving}>
              {t('profile.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
