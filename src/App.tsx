import { useEffect, useState } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useSessionStorage } from 'usehooks-ts'
import { PostModal } from '@/components/PostModal'
import { HomePage } from '@/pages/HomePage'
import { ListingDetailPage } from '@/pages/ListingDetailPage'
import { DEFAULT_LISTING_FILTERS } from '@/lib/constants'
import { POST_INTENT_KEY, useAuth } from '@/lib/AuthProvider'
import type { ListingFilters, MapBounds } from '@/lib/types'

export interface LayoutContext {
  openPostModal: () => void
  bounds: MapBounds | null
  setBounds: (bounds: MapBounds) => void
  filters: ListingFilters
  setFilters: (filters: ListingFilters) => void
}

function Layout() {
  const { user } = useAuth()
  const [postIntent, setPostIntent] = useSessionStorage(POST_INTENT_KEY, false)
  const [isPostModalOpen, setIsPostModalOpen] = useState(false)
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const [filters, setFilters] = useState<ListingFilters>(DEFAULT_LISTING_FILTERS)

  useEffect(() => {
    if (user && postIntent) {
      setPostIntent(false)
      setIsPostModalOpen(true)
    }
  }, [user, postIntent, setPostIntent])

  const context: LayoutContext = {
    openPostModal: () => setIsPostModalOpen(true),
    bounds,
    setBounds,
    filters,
    setFilters,
  }

  return (
    <>
      <Outlet context={context} />
      <PostModal open={isPostModalOpen} onOpenChange={setIsPostModalOpen} />
      <Toaster position="top-center" richColors />
    </>
  )
}

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/listing/:id" element={<ListingDetailPage />} />
      </Route>
    </Routes>
  )
}

export default App
