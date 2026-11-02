import { useEffect, useMemo, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import { useApp } from '@renderer/stores/globalStore'
import type { Note } from '../../../../shared/types/shared'
import { stripExt, useInlineRename } from '@renderer/hook/useInlineRename'
import { Toolbar, NoDrag } from '@renderer/components/Toolbar'

import ResizeHandle from '@renderer/components/ResizeHandle'
import { useResizableWidth } from '@renderer/hook/useResizableWidth'
import { historyPathMoved } from '@renderer/stores/historyStore'
import { applyPathMove } from '@renderer/lib/pathMoves'

export const NOTE_DRAG_TYPE = 'application/x-luna-note'

function fileName(notePath: string) {
  return stripExt(notePath.split(/[\\/]/).pop() ?? '')
}

function parentName(p: string) {
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 2] ?? ''
}

/* ---------- Icons ---------- */

function SidebarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9 4v16" />
      <path d="M5.5 8h1.5M5.5 11h1.5" />
    </svg>
  )
}

function ComposeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
      <path d="M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 8.5-8.5z" />
    </svg>
  )
}

function ImportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" />
    </svg>
  )
}

/* ---------- Title (used by the editor) ---------- */

export function NoteTitle({ notePath }: { notePath: string }) {
  const setActiveNote = useApp((s) => s.setActiveNote)
  const name = fileName(notePath)
  const [value, setValue] = useState(name)

  useEffect(() => setValue(name), [name])

  async function commit() {
    const newName = value.trim()
    if (!newName || newName === name) return setValue(name)
    try {
      const newPath = await window.api.aegis.rename(notePath, newName)
      historyPathMoved(notePath, newPath)
      setActiveNote(newPath)
    } catch (err) {
      console.error(err)
      setValue(name)
    }
  }

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setValue(name)
          e.currentTarget.blur()
        }
      }}
      onBlur={commit}
      className="text-2xl font-semibold bg-transparent outline-none w-full"
    />
  )
}

/* ---------- List item ---------- */

function NoteItem({ note, showNotebook }: { note: Note; showNotebook: boolean }) {
  const isActive = useApp((s) => s.activeNote === note.path)
  const isFavorite = useApp((s) => s.favorites.includes(note.path))
  const setActiveNote = useApp((s) => s.setActiveNote)
  const setActiveTag = useApp((s) => s.setActiveTag)
  const toggleFavorite = useApp((s) => s.toggleFavorite)
  const name = fileName(note.path)
  const tags = note.tags ?? []

  const { isRenaming, start, inputProps } = useInlineRename(note.path, name, (newPath) => {
    if (isActive) setActiveNote(newPath)
  })

  return (
    <div
      draggable={!isRenaming}
      onDragStart={(e) => {
        e.dataTransfer.setData(NOTE_DRAG_TYPE, note.path)
        e.dataTransfer.effectAllowed = 'move'
        window.dispatchEvent(new Event('note:flush')) // save unsaved edits before a move
      }}
      onClick={() => setActiveNote(note.path)}
      onDoubleClick={start}
      onContextMenu={(e) => {
        e.preventDefault()
        window.api.aegis.showNoteMenu(note.path)
      }}
      className={`group p-3 border-b border-line cursor-pointer ${isActive ? 'bg-selected' : 'hover:bg-hover'}`}
    >
      <div className="flex items-center gap-1">
        {isRenaming ? (
          <input
            {...inputProps}
            className="flex-1 min-w-0 font-medium bg-transparent outline-none border border-faint rounded px-1"
          />
        ) : (
          <div className="flex-1 min-w-0 font-medium truncate">{name}</div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleFavorite(note.path)
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          className={`shrink-0 p-0.5 rounded hover:bg-hover ${isFavorite ? 'text-amber-500' : 'text-muted opacity-0 group-hover:opacity-100'
            }`}
        >
          <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="text-sm text-muted line-clamp-2">{note.preview}</div>

      {/* Tags: click one to see every note with that tag */}
      {tags.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {tags.slice(0, 3).map((tag) => (
            <button
              key={tag}
              onClick={(e) => {
                e.stopPropagation()
                setActiveTag(tag)
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              title={`Show notes tagged #${tag}`}
              className="rounded bg-accent/10 px-1.5 py-px text-[11px] text-accent-fg hover:bg-accent/20"
            >
              #{tag}
            </button>
          ))}
          {tags.length > 3 && <span className="text-[11px] text-muted">+{tags.length - 3}</span>}
        </div>
      )}

      <div className="text-xs text-muted mt-1 flex items-center gap-1 min-w-0">
        <span className="shrink-0">{new Date(note.updatedAt).toLocaleDateString()}</span>
        {showNotebook && <span className="truncate">· {parentName(note.path)}</span>}
      </div>
    </div>
  )
}

/* ---------- Header title (double-click to rename the notebook) ---------- */

function HeaderTitle({
  title,
  canRename,
  onRename,
}: {
  title: string
  canRename: boolean
  onRename: (newName: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep in sync when switching notebooks (but not mid-edit)
  useEffect(() => {
    if (!editing) setValue(title)
  }, [title, editing])

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  async function commit() {
    const next = value.trim()
    setEditing(false)
    if (!next || next === title) return setValue(title)
    try {
      await onRename(next)
    } catch (err) {
      console.error('Failed to rename notebook:', err) // e.g. name already taken
      setValue(title)
    }
  }

  return (
    <div className="flex-1 min-w-0 flex justify-center">
      {editing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur() // blur commits
            if (e.key === 'Escape') {
              setValue(title)
              setEditing(false)
            }
          }}
          onBlur={commit}
          className="no-drag w-full min-w-0 text-center font-semibold bg-bg border border-accent rounded px-1 outline-none"
        />
      ) : (
        <span
          // no-drag: double-clicking a drag region would zoom the window instead
          className={`truncate font-semibold select-none ${canRename ? 'no-drag cursor-text rounded px-1 hover:bg-hover' : ''}`}
          onDoubleClick={canRename ? () => setEditing(true) : undefined}
          title={canRename ? 'Double-click to rename' : title}
        >
          {title}
        </span>
      )}
    </div>
  )
}

/* ---------- Header ---------- */

const iconBtn =
  'p-1.5 rounded-md text-muted hover:bg-hover hover:text-fg disabled:opacity-40 disabled:pointer-events-none'

function NotesHeader({
  title,
  canRename,
  onRename,
  query,
  onQueryChange,
  onNewNote,
  onImport,
  canCreate,
  collapsed,
  onToggle,
}: {
  title: string
  canRename: boolean
  onRename: (newName: string) => Promise<void>
  query: string
  onQueryChange: (q: string) => void
  onNewNote: () => void
  onImport: () => void
  canCreate: boolean
  collapsed: boolean
  onToggle: () => void
}) {
  const toggleButton = (
    <button onClick={onToggle} title={collapsed ? 'Expand notes list' : 'Collapse notes list'} className={iconBtn}>
      <SidebarIcon />
    </button>
  )

  const importButton = (
    <button onClick={onImport} disabled={!canCreate} title="Import files" className={iconBtn}>
      <ImportIcon />
    </button>
  )

  const newNoteButton = (
    <button onClick={onNewNote} disabled={!canCreate} title="New note" className={iconBtn}>
      <ComposeIcon />
    </button>
  )

  if (collapsed) {
    return (
      <div className="shrink-0 flex flex-col items-center gap-1 pt-3 no-drag">
        {toggleButton}
        {newNoteButton}
        {importButton}
      </div>
    )
  }

  return (
    <div className="shrink-0 bg-side">
      <Toolbar className="w-full">
        <div className="flex items-center w-full gap-1">
          <NoDrag>{toggleButton}</NoDrag>
          <HeaderTitle title={title} canRename={canRename} onRename={onRename} />
          <NoDrag>
            <div className="flex items-center">
              {importButton}
              {newNoteButton}
            </div>
          </NoDrag>
        </div>
      </Toolbar>

      <div className="px-3 pb-2">
        <label className="flex items-center gap-1.5 bg-bg rounded-md border border-line px-2 py-1 text-muted focus-within:border-accent">
          <FilterIcon />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onQueryChange('')
                e.currentTarget.blur()
              }
            }}
            placeholder="Filter (#tag for tags)"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-fg placeholder:text-muted"
          />
          {query && (
            <button
              onClick={() => onQueryChange('')}
              title="Clear filter"
              className="text-xs leading-none px-1 hover:text-fg"
            >
              ✕
            </button>
          )}
        </label>
      </div>
    </div>
  )
}

/* ---------- Main ---------- */

const IMPORTABLE = /\.(md|markdown|txt)$/i

export default function AegisViewer() {
  const view = useApp((s) => s.view)
  const activeAegis = useApp((s) => s.activeAegis)
  const activeTag = useApp((s) => s.activeTag)
  const notesVersion = useApp((s) => s.notesVersion)
  const favorites = useApp((s) => s.favorites)
  const noteSort = useApp((s) => s.prefs.noteSort) // Settings → Notes → Sort notes by
  const setActiveNote = useApp((s) => s.setActiveNote)
  const bumpNotes = useApp((s) => s.bumpNotes)

  const [notes, setNotes] = useState<Note[]>([])
  const [fsTick, setFsTick] = useState(0)
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [dragging, setDragging] = useState(false)

  const listWidth = useApp((s) => s.listWidth)
  const setListWidth = useApp((s) => s.setListWidth)
  const resize = useResizableWidth({
    width: listWidth,
    onSave: setListWidth,
    min: 200,
    max: 420,
    defaultWidth: 224,
  })

  const inAegis = view === 'aegis'
  const canCreate = inAegis && !!activeAegis

  useEffect(() => {
    return window.api.aegis.onFsChanged(() => setFsTick((t) => t + 1))
  }, [])

  // Load notes for the current view (tag, favorites and all-notes views load every notebook)
  useEffect(() => {
    let cancelled = false
    const load = inAegis
      ? activeAegis
        ? window.api.aegis.listNotes(activeAegis)
        : Promise.resolve<Note[]>([])
      : window.api.aegis.listAllNotes()

    load.then((list) => !cancelled && setNotes(list)).catch(() => !cancelled && setNotes([]))
    return () => {
      cancelled = true
    }
  }, [view, activeAegis, notesVersion, fsTick])

  // Clear the filter when switching notebook, view or tag
  useEffect(() => setQuery(''), [view, activeAegis, activeTag])

  const visible = useMemo(() => {
    const favSet = new Set(favorites)
    let base = notes
    if (view === 'favorites') base = notes.filter((n) => favSet.has(n.path))
    else if (view === 'tag') base = notes.filter((n) => !!activeTag && (n.tags ?? []).includes(activeTag))

    const q = query.trim().toLowerCase()
    const tagQuery = q.startsWith('#') ? q.slice(1) : null // "#work" → match tags only

    const filtered = !q
      ? base
      : base.filter((n) => {
        const tags = n.tags ?? []
        if (tagQuery !== null) return tags.some((t) => t.startsWith(tagQuery))
        return (
          fileName(n.path).toLowerCase().includes(q) ||
          n.preview?.toLowerCase().includes(q) ||
          tags.some((t) => t.includes(q))
        )
      })

    return noteSort === 'name'
      ? [...filtered].sort((a, b) =>
        fileName(a.path).localeCompare(fileName(b.path), undefined, { numeric: true, sensitivity: 'base' })
      )
      : filtered
  }, [notes, favorites, view, activeTag, query, noteSort])

  const title =
    view === 'all'
      ? 'All Notes'
      : view === 'favorites'
        ? 'Favorites'
        : view === 'tag'
          ? `#${activeTag ?? ''}`
          : activeAegis
            ? parentName(activeAegis + '/x')
            : 'Notes'

  async function newNote() {
    if (!canCreate) return
    try {
      const path = await window.api.aegis.createNote(activeAegis!)
      bumpNotes()
      setActiveNote(path)
      setQuery('')
    } catch (err) {
      console.error('Failed to create note:', err)
    }
  }

  async function importNotes(filePaths?: string[]) {
    if (!canCreate) return
    try {
      const imported = await window.api.aegis.importNotes(activeAegis!, filePaths)
      if (imported.length === 0) return
      bumpNotes()
      setQuery('')
      setActiveNote(imported[0])
    } catch (err) {
      console.error('Failed to import notes:', err)
    }
  }

  // Rename the current notebook (from double-clicking the header title)
  async function renameAegis(newName: string) {
    if (!activeAegis) return
    const oldPath = activeAegis

    // Save unsaved edits first, so they aren't written into the old folder
    window.dispatchEvent(new Event('note:flush'))
    await new Promise((r) => setTimeout(r, 100))

    const newPath = await window.api.aegis.rename(oldPath, newName) // throws if the name is taken

    // Point the open notebook, open note, history and expanded folders at the new location
    applyPathMove(oldPath, newPath)
    useApp.getState().loadTree() // refresh the sidebar
  }

  /* ----- drag and drop from Finder ----- */

  function hasFiles(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes('Files')
  }

  function onDragOver(e: React.DragEvent) {
    if (!canCreate || !hasFiles(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!dragging) setDragging(true)
  }

  function onDragLeave(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragging(false)
  }

  function onDrop(e: React.DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    setDragging(false)
    if (!canCreate) return

    const paths = Array.from(e.dataTransfer.files)
      .filter((f) => IMPORTABLE.test(f.name))
      .map((f) => window.api.aegis.getPathForFile(f))
      .filter(Boolean)

    if (paths.length) importNotes(paths)
  }

  /* ----- empty states ----- */

  let emptyMessage: string | null = null
  if (inAegis && !activeAegis) emptyMessage = 'Select an Aegis'
  else if (view === 'favorites' && visible.length === 0 && !query)
    emptyMessage = 'No favorites yet. Hover a note and click the ☆ to add it.'
  else if (view === 'tag' && visible.length === 0 && !query) emptyMessage = 'No notes with this tag'
  else if (notes.length === 0) emptyMessage = inAegis ? 'No notes yet. Create one or drop .md files here.' : 'No notes yet'
  else if (visible.length === 0) emptyMessage = `No notes match “${query}”`

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{ width: collapsed ? 48 : resize.width }}
      className={`relative h-full shrink-0 border-r border-line min-h-0 bg-side flex flex-col overflow-hidden ${resize.dragging ? '' : 'transition-[width] duration-200 ease-out'
        }`}
    >
      <NotesHeader
        title={title}
        canRename={canCreate}
        onRename={renameAegis}
        query={query}
        onQueryChange={setQuery}
        onNewNote={newNote}
        onImport={() => importNotes()}
        canCreate={canCreate}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />

      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {emptyMessage && <div className="p-4 text-muted text-sm">{emptyMessage}</div>}

          {visible.map((note) => (
            <NoteItem key={note.path} note={note} showNotebook={!inAegis} />
          ))}
        </div>
      )}

      {dragging && (
        <div className="absolute inset-0 z-20 m-1 rounded-lg border-2 border-dashed border-accent bg-accent/10 flex items-center justify-center pointer-events-none">
          <span className="text-sm font-medium text-accent-fg text-center px-2">Drop to import</span>
        </div>
      )}
      {!collapsed && <ResizeHandle dragging={resize.dragging} {...resize.handleProps} />}
    </div>
  )
}