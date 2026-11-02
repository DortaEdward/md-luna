import { useEffect } from 'react'
import { useApp, type Prefs } from '@renderer/stores/globalStore'

const FONTS: Record<Prefs['editorFont'], string> = {
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  sans: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  serif: 'ui-serif, "New York", Georgia, serif',
}

/** Applies appearance preferences as CSS variables on <html> */
export function useApplyPrefs() {
  const fontSize = useApp((s) => s.prefs.editorFontSize)
  const font = useApp((s) => s.prefs.editorFont)

  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--editor-font-size', `${fontSize}px`)
    root.setProperty('--editor-font', FONTS[font])
  }, [fontSize, font])
}