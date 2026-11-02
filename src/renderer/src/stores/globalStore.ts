import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_VIM_CONFIG } from '@renderer/lib/vimDefaults'
import type { Aegis } from '../../../shared/types/aegis.types'
import type { NoteView } from '../../../shared/types/shared'
import { flattenAegis } from '../../../shared/tree'

export type Theme = 'system' | 'light' | 'dark'

export type Prefs = {
  editorFontSize: number
  editorFont: 'mono' | 'sans' | 'serif'
  previewWidth: 'full' | 'readable'
  defaultMode: 'edit' | 'split' | 'preview'
  spellcheck: boolean
  vimMode: boolean
  lineNumbers: boolean
  relativeLineNumbers: boolean
  vimConfig: string
  autosaveDelay: number
  noteSort: 'updated' | 'name'
  displayName: string
}

export const DEFAULT_PREFS: Prefs = {
  editorFontSize: 14,
  editorFont: 'mono',
  previewWidth: 'full',
  defaultMode: 'edit',
  spellcheck: true,
  vimMode: true,
  lineNumbers: false,
  relativeLineNumbers: false,
  vimConfig: DEFAULT_VIM_CONFIG,
  autosaveDelay: 700,
  noteSort: 'updated',
  displayName: ''
}

interface AppState {
  tree: Aegis[]
  notesVersion: number
  loadTree: () => Promise<void>
  bumpNotes: () => void
  systemName: string
  loadSystemName: () => Promise<void>

  activeAegis: string | null
  activeNote: string | null
  setActiveAegis: (path: string | null) => void
  setActiveNote: (path: string | null) => void

  activeTag: string | null
  setActiveTag: (tag: string) => void
  tags: { name: string; count: number }[]
  loadTags: () => Promise<void>

  sidebarWidth: number
  listWidth: number
  setSidebarWidth: (w: number) => void
  setListWidth: (w: number) => void

  /** Notebooks whose nested notebooks are shown in the sidebar */
  expandedAegis: string[]
  toggleExpanded: (path: string) => void
  /** Open every parent of `path` so it's visible in the sidebar */
  revealAegis: (path: string) => void

  showAegisSidebar: boolean
  toggleAegisSidebar: () => void

  view: NoteView
  setView: (view: NoteView) => void

  favorites: string[]
  loadFavorites: () => Promise<void>
  toggleFavorite: (notePath: string) => Promise<void>

  theme: Theme
  setTheme: (theme: Theme) => void

  prefs: Prefs
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void
  resetPrefs: () => void

  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      /* ----- notebooks ----- */
      tree: [],
      notesVersion: 0,
      loadTree: async () => {
        const tree = await window.api.aegis.getTree()
        const { activeAegis, activeNote } = get()
        const all = flattenAegis(tree)

        // The remembered notebook was deleted or renamed outside the app: clear it
        const aegisExists = !activeAegis || all.some((a) => a.path === activeAegis)

        set({
          tree,
          ...(aegisExists ? {} : { activeAegis: null, activeNote: null })
        })

        // Also clear the note if it was inside a notebook that's gone
        if (
          activeNote &&
          !all.some(
            (a) => activeNote.startsWith(a.path + '/') || activeNote.startsWith(a.path + '\\')
          )
        ) {
          set({ activeNote: null })
        }
      },
      bumpNotes: () => set((s) => ({ notesVersion: s.notesVersion + 1 })),

      /* ----- selection ----- */
      activeAegis: null,
      activeNote: null,
      setActiveAegis: (path) => set({ activeAegis: path, view: 'aegis' }),
      setActiveNote: (path) => set({ activeNote: path }),
      /* ----- tags ----- */
      activeTag: null,
      setActiveTag: (tag) => set({ activeTag: tag, view: 'tag' }),
      tags: [],
      loadTags: async () => {
        const tags = await window.api.aegis.listTags()
        set({ tags })
      },

      /* ----- nested notebooks ----- */
      expandedAegis: [],
      toggleExpanded: (path) =>
        set((s) => ({
          expandedAegis: s.expandedAegis.includes(path)
            ? s.expandedAegis.filter((p) => p !== path)
            : [...s.expandedAegis, path]
        })),
      revealAegis: (path) =>
        set((s) => {
          const parents = flattenAegis(s.tree)
            .filter((a) => path !== a.path && (path.startsWith(a.path + '/') || path.startsWith(a.path + '\\')))
            .map((a) => a.path)
          return { expandedAegis: [...new Set([...s.expandedAegis, ...parents])] }
        }),

      /* ----- layout ----- */
      showAegisSidebar: true,
      toggleAegisSidebar: () => set((s) => ({ showAegisSidebar: !s.showAegisSidebar })),
      sidebarWidth: 256,
      listWidth: 224,
      setSidebarWidth: (w) => set({ sidebarWidth: w }),
      setListWidth: (w) => set({ listWidth: w }),

      /* ----- view: one notebook, all notes, or favorites ----- */
      view: 'aegis',
      setView: (view) => set({ view }),

      /* ----- favorites ----- */
      favorites: [],
      loadFavorites: async () => {
        const favorites = await window.api.aegis.getFavorites()
        set({ favorites })
      },
      toggleFavorite: async (notePath) => {
        const on = !get().favorites.includes(notePath)
        const favorites = await window.api.aegis.setFavorite(notePath, on)
        set({ favorites })
      },

      /* ----- theme ----- */
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      /* ----- preferences ----- */
      prefs: DEFAULT_PREFS,
      setPref: (key, value) => set((s) => ({ prefs: { ...s.prefs, [key]: value } })),
      resetPrefs: () => set({ prefs: DEFAULT_PREFS, theme: 'system' }),
      systemName: '',
      loadSystemName: async () => {
        const systemName = await window.api.settings.getUserName()
        set({ systemName })
      },
      /* ----- settings modal ----- */
      settingsOpen: false,
      setSettingsOpen: (open) => set({ settingsOpen: open })
    }),
    {
      name: 'aegis-ui',
      partialize: (s) => ({
        activeAegis: s.activeAegis,
        activeNote: s.activeNote,
        view: s.view,
        theme: s.theme,
        activeTag: s.activeTag,
        prefs: s.prefs,
        sidebarWidth: s.sidebarWidth,
        expandedAegis: s.expandedAegis,
        listWidth: s.listWidth
      }),
      // Fill in any preferences added in a later version
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>
        return { ...current, ...p, prefs: { ...DEFAULT_PREFS, ...p.prefs } }
      }
    }
  )
)
