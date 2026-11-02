type ResizeHandleProps = {
  dragging: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onDoubleClick: () => void
}

/** A thin grab area on a column's right edge. The parent must be `relative`. */
export default function ResizeHandle({ dragging, ...handlers }: ResizeHandleProps) {
  return (
    <div
      {...handlers}
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize · double-click to reset"
      // no-drag: the top of the column is a window-drag area, which would swallow the drag
      className="no-drag group absolute top-0 right-0 z-30 h-full w-1.5 cursor-col-resize"
    >
      <div
        className={`ml-auto h-full w-0.5 transition-colors ${
          dragging ? 'bg-accent' : 'bg-transparent group-hover:bg-accent/60'
        }`}
      />
    </div>
  )
}