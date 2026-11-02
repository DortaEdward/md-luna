import { useEffect, useRef, useState } from 'react'
import { historyPathMoved } from '@renderer/stores/historyStore'

export function stripExt(name: string) {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

export function useInlineRename(
  itemPath: string,
  displayName: string,
  onRenamed?: (newPath: string) => void
) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [value, setValue] = useState(displayName)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const finishingRef = useRef(false)

  function start() {
    setValue(displayName)
    setIsRenaming(true)
  }

  // Context menu "Rename", or a just-created notebook asking for a name
  useEffect(() => {
    const off = window.api.aegis.onRenameRequest((path) => {
      if (path === itemPath) start()
    })
    function onLocal(e: Event): void {
      if ((e as CustomEvent<string>).detail === itemPath) start()
    }
    window.addEventListener('rename:request', onLocal)
    return () => {
      off()
      window.removeEventListener('rename:request', onLocal)
    }
  }, [itemPath, displayName])

  // Focus and select once the input has rendered
  useEffect(() => {
    if (!isRenaming) return
    const input = inputRef.current
    input?.focus()
    input?.select()
  }, [isRenaming])

  async function finish(save: boolean) {
    if (finishingRef.current) return
    finishingRef.current = true

    const newName = value.trim()
    setIsRenaming(false)

    if (save && newName && newName !== displayName) {
      try {
        const newPath = await window.api.aegis.rename(itemPath, newName)
        historyPathMoved(itemPath, newPath)
        onRenamed?.(newPath)
      } catch (err) {
        console.error(err)
        setValue(displayName)
      }
    }
    finishingRef.current = false
  }

  const inputProps = {
    ref: inputRef,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') finish(true)
      if (e.key === 'Escape') finish(false)
    },
    onBlur: () => finish(true)
  }

  return { isRenaming, start, inputProps }
}