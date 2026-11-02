import { create } from 'zustand'
import { useApp } from './globalStore'
import { isInside } from '@renderer/lib/paths'
import type { NoteView } from '../../../shared/types/shared'

/*
 * Back / forward history, like a web browser.
 * Every time you open a note, notebook, tag or view, that place is recorded.
 * The toolbar arrows, ⌘[ / ⌘] and the mouse's back/forward buttons move through it.
 */

type Place = {
  view: NoteView
  activeAegis: string | null
  activeTag: string | null
  activeNote: string | null
}

type HistoryState = {
  entries: Place[]
  index: number
}

const MAX_ENTRIES = 100

export const useHistory = create<HistoryState>(() => ({ entries: [], index: -1 }))

let navigating = false

function currentPlace(): Place {
  const { view, activeAegis, activeTag, activeNote } = useApp.getState()
  return { view, activeAegis, activeTag, activeNote }
}

const samePlace = (a: Place, b: Place): boolean =>
  a.view === b.view &&
  a.activeAegis === b.activeAegis &&
  a.activeTag === b.activeTag &&
  a.activeNote === b.activeNote

function record(place: Place): void {
  const { entries, index } = useHistory.getState()
  const current = entries[index]
  if (current && samePlace(current, place)) return

  // Opening a note right after choosing a notebook/view: replace the empty
  // step instead of adding one, so Back goes to the previous note
  const replaceCurrent =
    current &&
    current.activeNote === null &&
    current.view === place.view &&
    current.activeAegis === place.activeAegis &&
    current.activeTag === place.activeTag

  const kept = entries.slice(0, replaceCurrent ? index : index + 1) // drop any "forward" steps
  const next = [...kept, place].slice(-MAX_ENTRIES)
  useHistory.setState({ entries: next, index: next.length - 1 })
}

function go(step: number): void {
  const { entries, index } = useHistory.getState()
  const target = entries[index + step]
  if (!target) return

  window.dispatchEvent(new Event('note:flush')) // save the note you're leaving
  navigating = true
  try {
    useApp.setState(target)
  } finally {
    navigating = false
  }
  useHistory.setState({ index: index + step })
}

export const goBack = (): void => go(-1)
export const goForward = (): void => go(1)

/** A note or notebook was renamed or moved: update the history so it still points at it */
export function historyPathMoved(oldPath: string, newPath: string): void {
  const fix = (p: string | null): string | null =>
    p && isInside(p, oldPath) ? newPath + p.slice(oldPath.length) : p
  const { entries } = useHistory.getState()
  useHistory.setState({
    entries: entries.map((e) => ({ ...e, activeAegis: fix(e.activeAegis), activeNote: fix(e.activeNote) }))
  })
}

/** A note or notebook went to the Trash: forget every step that pointed into it */
export function historyPathRemoved(target: string): void {
  const { entries, index } = useHistory.getState()
  const keep = (e: Place): boolean => !isInside(e.activeNote, target) && !isInside(e.activeAegis, target)
  const before = entries.slice(0, index + 1).filter(keep).length
  const next = entries.filter(keep)
  useHistory.setState({ entries: next, index: Math.max(0, Math.min(before, next.length) - 1) })
}

/** Start recording. Returns a function that stops it. */
export function startHistory(): () => void {
  record(currentPlace())
  return useApp.subscribe((s, prev) => {
    if (navigating) return
    if (
      s.view === prev.view &&
      s.activeAegis === prev.activeAegis &&
      s.activeTag === prev.activeTag &&
      s.activeNote === prev.activeNote
    )
      return
    record(currentPlace())
  })
}
