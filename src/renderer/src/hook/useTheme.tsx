import { useEffect } from 'react'
import { useApp } from '@renderer/stores/globalStore'

export function useTheme() {
  const theme = useApp((s) => s.theme)

  useEffect(() => {
    window.api.window.setTheme(theme)

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
    }

    apply()
    if (theme !== 'system') return
    media.addEventListener('change', apply) // follow macOS when set to System
    return () => media.removeEventListener('change', apply)
  }, [theme])
}