import imageCompression from 'browser-image-compression'
import { supabase, LISTING_PHOTOS_BUCKET } from '@/lib/supabaseClient'

export async function uploadListingImages(files: File[]): Promise<string[]> {
  const urls: string[] = []
  for (const file of files) {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
    })
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage
      .from(LISTING_PHOTOS_BUCKET)
      .upload(path, compressed, { contentType: file.type })
    if (error) throw error
    const { data } = supabase.storage.from(LISTING_PHOTOS_BUCKET).getPublicUrl(path)
    urls.push(data.publicUrl)
  }
  return urls
}

function storagePathFromUrl(url: string): string | null {
  const marker = `/${LISTING_PHOTOS_BUCKET}/`
  const index = url.indexOf(marker)
  return index === -1 ? null : url.slice(index + marker.length)
}

// Best-effort: called after a listing row is already deleted/updated, so a
// failure here shouldn't surface as if the user's action failed — it just
// leaves an orphaned object in storage for later cleanup.
export async function deleteListingImages(urls: string[]): Promise<void> {
  const paths = urls.map(storagePathFromUrl).filter((p): p is string => !!p)
  if (paths.length === 0) return
  await supabase.storage.from(LISTING_PHOTOS_BUCKET).remove(paths)
}
