import { useApp } from '@renderer/stores/globalStore'

/** The name to show: custom name from Settings, else the computer's name */
export function useDisplayName() {
  const custom = useApp((s) => s.prefs.displayName ?? '')
  const system = useApp((s) => s.systemName ?? '')
  return custom.trim() || system || 'You'
}

/** "Edward Dorta" → "ED", "edward" → "E" */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = [...words[0]][0] ?? ''
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? '') : ''
  return (first + last).toUpperCase()
}