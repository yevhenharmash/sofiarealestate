import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ListingImageProps {
  src: string
  alt: string
  className?: string
  iconClassName?: string
  onClick?: () => void
  loading?: 'lazy' | 'eager'
}

// Storage objects can go missing (deleted directly, bucket policy changes,
// a stale URL from before a re-upload) — fall back to the same placeholder
// used for listings with no photos at all, instead of a broken-image icon.
export function ListingImage({ src, alt, className, iconClassName, onClick, loading }: ListingImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        onClick={onClick}
        className={cn('flex items-center justify-center text-muted-foreground', className)}
      >
        <ImageOff className={iconClassName ?? 'h-6 w-6'} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onClick={onClick}
      onError={() => setFailed(true)}
      loading={loading ?? 'lazy'}
    />
  )
}
