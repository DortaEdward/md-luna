import { Monitor, Moon, Sun } from 'lucide-react'
import { useApp, type Theme } from '@renderer/stores/globalStore'

const ORDER: Theme[] = ['system', 'light', 'dark']
const LABEL: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' }

export default function ThemeToggle() {
  const theme = useApp((s) => s.theme)
  const setTheme = useApp((s) => s.setTheme)

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <button
      onClick={() => setTheme(next)}
      title={`Theme: ${LABEL[theme]} (click for ${LABEL[next]})`}
      className="p-1.5 rounded-md text-muted hover:bg-hover hover:text-fg"
    >
      <Icon size={18} />
    </button>
  )
}