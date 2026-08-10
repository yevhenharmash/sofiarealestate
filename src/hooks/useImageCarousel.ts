import { useState } from 'react'

export function useImageCarousel(images: string[]) {
  const [index, setIndex] = useState(0)

  function next(e?: React.MouseEvent) {
    e?.stopPropagation()
    setIndex((i) => (i + 1) % images.length)
  }

  function prev(e?: React.MouseEvent) {
    e?.stopPropagation()
    setIndex((i) => (i - 1 + images.length) % images.length)
  }

  return { index, next, prev, hasMultiple: images.length > 1 }
}
