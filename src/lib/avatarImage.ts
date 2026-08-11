import imageCompression from 'browser-image-compression'
import { supabase, AVATARS_BUCKET } from '@/lib/supabaseClient'

// Canonical path per user — always the same object, so a re-upload just
// overwrites it (upsert) instead of needing to track and delete a previous
// file. Always normalized to jpeg so the path/extension never changes.
function avatarPath(userId: string): string {
  return `${userId}/avatar.jpg`
}

export async function uploadAvatarImage(file: File, userId: string): Promise<string> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 512,
    useWebWorker: true,
    fileType: 'image/jpeg',
  })

  const path = avatarPath(userId)
  const { error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, compressed, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
  // The object path never changes between uploads, so browsers/CDNs would
  // otherwise keep serving a cached copy of the old picture at this URL.
  return `${data.publicUrl}?v=${Date.now()}`
}
