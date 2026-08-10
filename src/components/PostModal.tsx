import { useState } from 'react'
import imageCompression from 'browser-image-compression'
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
import { supabase, LISTING_PHOTOS_BUCKET } from '@/lib/supabaseClient'
import { isValidBulgarianMobile } from '@/lib/phone'
import type { ListingType } from '@/lib/types'
import { LISTING_TYPE_LABELS } from '@/lib/types'
import { SOFIA_CENTER } from '@/lib/constants'

const MAX_IMAGES = 6

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
}

const INITIAL_FORM: FormState = {
  title: '',
  description: '',
  price: '',
  type: 'flat',
  phone: '',
}

const DEFAULT_POSITION = { lat: SOFIA_CENTER[0], lng: SOFIA_CENTER[1] }

export function PostModal({ open, onOpenChange }: PostModalProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [position, setPosition] = useState<{ lat: number; lng: number }>(DEFAULT_POSITION)
  const [files, setFiles] = useState<File[]>([])
  const [honeypot, setHoneypot] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function resetAndClose() {
    setForm(INITIAL_FORM)
    setPosition(DEFAULT_POSITION)
    setFiles([])
    setHoneypot('')
    onOpenChange(false)
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error('Your browser does not support geolocation.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast.error('Could not access your location. Check your browser permissions.'),
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

  async function uploadImages(): Promise<string[]> {
    const urls: string[] = []
    for (const file of files) {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      })
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(LISTING_PHOTOS_BUCKET)
        .upload(path, compressed, { contentType: file.type })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from(LISTING_PHOTOS_BUCKET).getPublicUrl(path)
      urls.push(data.publicUrl)
    }
    return urls
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Honeypot: real users never fill this hidden field. Silently "succeed"
    // for bots instead of telling them what tripped the check.
    if (honeypot) {
      resetAndClose()
      return
    }

    if (!form.title.trim()) return toast.error('Title is required.')
    const price = Number(form.price)
    if (!form.price || Number.isNaN(price) || price <= 0) return toast.error('Enter a valid price.')
    if (!isValidBulgarianMobile(form.phone)) {
      return toast.error('Enter a valid Bulgarian mobile number, e.g. 0888 123 456.')
    }

    setIsSubmitting(true)
    try {
      const images = await uploadImages()

      const { error: insertError } = await supabase.from('listings').insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        price,
        type: form.type,
        phone: form.phone.trim(),
        images,
        location: `POINT(${position.lng} ${position.lat})`,
      })

      if (insertError) throw insertError

      await queryClient.invalidateQueries({ queryKey: ['listings'] })
      toast.success('Listing posted.')
      resetAndClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : resetAndClose())}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Post a listing</DialogTitle>
          <DialogDescription>
            Fill in the details below. It'll appear on the map instantly.
          </DialogDescription>
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
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Cozy 1-bedroom near Vitosha Blvd"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Details about the place, amenities, availability…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price">Price (EUR / month)</Label>
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
              <Label htmlFor="type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) => setForm({ ...form, type: value as ListingType })}
              >
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LISTING_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="0888 123 456"
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Location</Label>
              <Button type="button" variant="ghost" size="sm" onClick={useMyLocation}>
                Use my location
              </Button>
            </div>
            <LocationPicker position={position} onChange={(lat, lng) => setPosition({ lat, lng })} />
            <p className="text-xs text-muted-foreground">
              Click on the map or drag the pin to set the exact location.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Photos</Label>
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
            <p className="text-xs text-muted-foreground">Up to {MAX_IMAGES} photos, 5MB each.</p>
          </div>
        </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Post listing
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
