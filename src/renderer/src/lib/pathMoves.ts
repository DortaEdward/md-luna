import { useApp } from '@renderer/stores/globalStore'
import { historyPathMoved } from '@renderer/stores/historyStore'
import { isInside } from './paths'

/** Event name for asking an item (note or notebook) to show its rename box */
export const RENAME_EVENT = 'rename:request'

export function requestRename(path: string): void {
  window.dispatchEvent(new CustomEvent(RENAME_EVENT, { detail: path }))
}

/**
 * A note or notebook was renamed or moved from `oldPath` to `newPath`.
 * Point everything that referred to it (open notebook, open note, expanded
 * folders, back/forward history) at the new location.
 */
export function applyPathMove(oldPath: string, newPath: string): void {
  const fix = (p: string | null): string | null =>
    p && isInside(p, oldPath) ? newPath + p.slice(oldPath.length) : p

  const { activeAegis, activeNote, expandedAegis } = useApp.getState()
  historyPathMoved(oldPath, newPath)
  useApp.setState({
    activeAegis: fix(activeAegis),
    activeNote: fix(activeNote),
    expandedAegis: expandedAegis.map((p) => fix(p) as string)
  })
}
