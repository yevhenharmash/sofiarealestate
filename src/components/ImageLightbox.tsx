import { Dialog as DialogPrimitive } from 'radix-ui'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { ListingImage } from '@/components/ListingImage'
import { useLang } from '@/lib/i18n'

interface ImageLightboxProps {
  images: string[]
  index: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onIndexChange: (index: number) => void
}

// Built on the raw Radix Dialog primitive (not the styled ui/dialog.tsx
// wrapper) since a fullscreen photo viewer needs edge-to-edge black chrome,
// not a centered card. Still gets Radix's focus trap + Escape-to-close for
// free; only backdrop-click and arrow-key nav are handled manually here.
export function ImageLightbox({ images, index, open, onOpenChange, onIndexChange }: ImageLightboxProps) {
  const { t } = useLang()
  const hasMultiple = images.length > 1

  function next(e?: React.MouseEvent) {
    e?.stopPropagation()
    onIndexChange((index + 1) % images.length)
  }

  function prev(e?: React.MouseEvent) {
    e?.stopPropagation()
    onIndexChange((index - 1 + images.length) % images.length)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') next()
    if (e.key === 'ArrowLeft') prev()
  }

  if (images.length === 0) return null

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-100 bg-black/90 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          onKeyDown={handleKeyDown}
          onClick={() => onOpenChange(false)}
          className="fixed inset-0 z-100 flex items-center justify-center outline-none"
        >
          <DialogPrimitive.Title className="sr-only">
            {t('detail.photoIndex', { current: index + 1, total: images.length })}
          </DialogPrimitive.Title>

          <DialogPrimitive.Close
            aria-label={t('detail.closePhoto')}
            className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          >
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>

          <div onClick={(e) => e.stopPropagation()}>
            <ListingImage
              src={images[index]}
              alt=""
              className="max-h-[90vh] max-w-[90vw] object-contain"
              iconClassName="h-10 w-10 text-white"
            />
          </div>

          {hasMultiple && (
            <>
              <button
                type="button"
                aria-label={t('listing.prevPhoto')}
                onClick={prev}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label={t('listing.nextPhoto')}
                onClick={next}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                {t('detail.photoIndex', { current: index + 1, total: images.length })}
              </span>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
