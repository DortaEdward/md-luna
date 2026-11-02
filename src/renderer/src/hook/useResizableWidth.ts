import { useState } from 'react'

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/**
 * Drag-to-resize for a column. While dragging, the width lives in local state
 * (smooth, no storage writes); it's saved once when you let go.
 */
export function useResizableWidth({
  width,
  onSave,
  min,
  max,
  defaultWidth,
}: {
  width: number
  onSave: (w: number) => void
  min: number
  max: number
  defaultWidth: number
}) {
  const [live, setLive] = useState<number | null>(null)

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    e.preventDefault()

    const startX = e.clientX
    const startWidth = width
    let current = startWidth
    setLive(startWidth)

    // Keep the resize cursor everywhere and stop text getting selected while dragging
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function onMove(ev: PointerEvent) {
      current = clamp(startWidth + ev.clientX - startX, min, max)
      setLive(current)
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setLive(null)
      onSave(current)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return {
    width: live ?? clamp(width, min, max),
    dragging: live !== null,
    handleProps: {
      onPointerDown,
      onDoubleClick: () => onSave(defaultWidth), // double-click resets
    },
  }
}