import { useEffect, useState, type ReactNode } from 'react'
import { FolderOpen, Keyboard, Palette, PenLine, User, X } from 'lucide-react'
import { useApp, type Prefs, type Theme } from '@renderer/stores/globalStore'
import { initials } from '@renderer/hook/useUser'
import { applyVimConfig } from '@renderer/lib/vimConfig'
import { DEFAULT_VIM_CONFIG } from '@renderer/lib/vimDefaults'

type Tab = 'profile' | 'appearance' | 'editor' | 'notes' | 'shortcuts'

const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'editor', label: 'Editor', icon: PenLine },
  { id: 'notes', label: 'Notes', icon: FolderOpen },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
]

const SHORTCUTS: [string, string][] = [
  ['⌘ K', 'Search notebooks and notes'],
  ['⌘ 1', 'Editor only'],
  ['⌘ 2', 'Editor and preview'],
  ['⌘ 3', 'Preview only'],
  ['⌘ ⇧ O', 'Jump to a section (in the preview)'],
  ['⌘ /', 'Markdown reference'],
  ['⌘ ,', 'Settings'],
  ['Esc', 'Close any window or popup'],
]

/* ---------- Controls ---------- */

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-md bg-hover p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded ${
            o.value === value ? 'bg-bg text-fg shadow-sm' : 'text-muted hover:text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-hover-strong'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : ''
        }`}
      />
    </button>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3 border-b border-line last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

/* ---------- Tabs ---------- */

function ProfileTab() {
  const displayName = useApp((s) => s.prefs.displayName ?? '') // ?? '' : never undefined
  const systemName = useApp((s) => s.systemName ?? '') // ?? '' : never undefined
  const setPref = useApp((s) => s.setPref)
  const shown = displayName.trim() || systemName || 'You'

  return (
    <>
      <div className="flex items-center gap-3 py-4 border-b border-line">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-medium text-white">
          {initials(shown)}
        </div>
        <div className="min-w-0">
          <div className="truncate font-medium">{shown}</div>
          <div className="text-xs text-muted">{displayName.trim() ? 'Custom name' : 'From this computer'}</div>
        </div>
      </div>

      <Row label="Name" hint="Leave empty to use your computer's name.">
        <div className="flex items-center gap-2">
          <input
            value={displayName}
            onChange={(e) => setPref('displayName', e.target.value)}
            placeholder={systemName || 'Your name'}
            maxLength={60}
            className="w-48 rounded-md border border-line bg-bg px-2 py-1 text-sm outline-none focus:border-accent placeholder:text-muted"
          />
          {displayName && (
            <button onClick={() => setPref('displayName', '')} className="text-xs text-muted hover:text-fg">
              Reset
            </button>
          )}
        </div>
      </Row>
    </>
  )
}

function AppearanceTab() {
  const theme = useApp((s) => s.theme)
  const setTheme = useApp((s) => s.setTheme)
  const prefs = useApp((s) => s.prefs)
  const setPref = useApp((s) => s.setPref)

  return (
    <>
      <Row label="Theme" hint="System follows your Mac's appearance.">
        <Segmented<Theme>
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Row>

      <Row label="Editor font">
        <Segmented<Prefs['editorFont']>
          value={prefs.editorFont}
          onChange={(v) => setPref('editorFont', v)}
          options={[
            { value: 'mono', label: 'Mono' },
            { value: 'sans', label: 'Sans' },
            { value: 'serif', label: 'Serif' },
          ]}
        />
      </Row>

      <Row label="Editor font size">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={12}
            max={22}
            step={1}
            value={prefs.editorFontSize}
            onChange={(e) => setPref('editorFontSize', Number(e.target.value))}
            className="w-32 accent-accent"
          />
          <span className="w-10 text-right text-sm tabular-nums text-muted">{prefs.editorFontSize}px</span>
        </div>
      </Row>

      <div
        className="my-3 rounded-lg border border-line bg-hover px-4 py-3"
        style={{ fontFamily: 'var(--editor-font)', fontSize: 'var(--editor-font-size)', lineHeight: 1.6 }}
      >
        # A sample note
        <br />
        The quick brown fox jumps over the **lazy** dog.
      </div>

      <Row label="Preview width" hint="Readable keeps lines to a comfortable length.">
        <Segmented<Prefs['previewWidth']>
          value={prefs.previewWidth}
          onChange={(v) => setPref('previewWidth', v)}
          options={[
            { value: 'full', label: 'Full' },
            { value: 'readable', label: 'Readable' },
          ]}
        />
      </Row>
    </>
  )
}

function VimKeymaps() {
  const config = useApp((s) => s.prefs.vimConfig)
  const setPref = useApp((s) => s.setPref)
  const [draft, setDraft] = useState(config)
  const [errors, setErrors] = useState(() => applyVimConfig(config))

  // Apply shortly after typing stops
  useEffect(() => {
    if (draft === config) return
    const t = setTimeout(() => {
      setErrors(applyVimConfig(draft))
      setPref('vimConfig', draft)
    }, 400)
    return () => clearTimeout(t)
  }, [draft, config, setPref])

  return (
    <div className="py-3 border-b border-line">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="text-sm font-medium">Vim keymaps</div>
          <div className="text-xs text-muted mt-0.5">
            Neovim Lua or Vimscript mappings, e.g.{' '}
            <code className="font-mono">vim.keymap.set("n", "&lt;leader&gt;pv", vim.cmd.Ex)</code>
          </div>
        </div>
        <button
          onClick={() => setDraft(DEFAULT_VIM_CONFIG)}
          className="shrink-0 text-xs text-muted hover:text-fg"
        >
          Reset
        </button>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // Let Tab indent inside the box instead of leaving it
          if (e.key === 'Tab') {
            e.preventDefault()
            const el = e.currentTarget
            const { selectionStart: a, selectionEnd: b } = el
            const next = draft.slice(0, a) + '  ' + draft.slice(b)
            setDraft(next)
            requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2))
          }
        }}
        spellCheck={false}
        rows={9}
        className="mt-2 w-full resize-y rounded-md border border-line bg-transparent p-2 font-mono text-xs leading-relaxed outline-none focus:border-accent"
      />
      {errors.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-xs text-red-500">
          {errors.map((e, i) => (
            <li key={i}>
              {e.line > 0 && <span className="font-mono">Line {e.line}: </span>}
              {e.message}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 text-xs text-muted">
          App commands: :w :q :wq :Ex :Sidebar :Editor :Split :Preview :Favorite :Settings :ExportPdf :ExportHtml
        </div>
      )}
    </div>
  )
}

function EditorTab() {
  const prefs = useApp((s) => s.prefs)
  const setPref = useApp((s) => s.setPref)

  return (
    <>
      <Row label="Open notes in" hint="The view used when the app starts.">
        <Segmented<Prefs['defaultMode']>
          value={prefs.defaultMode}
          onChange={(v) => setPref('defaultMode', v)}
          options={[
            { value: 'edit', label: 'Editor' },
            { value: 'split', label: 'Split' },
            { value: 'preview', label: 'Preview' },
          ]}
        />
      </Row>

      <Row label="Line numbers" hint="Show a number beside each line.">
        <Toggle label="Line numbers" checked={prefs.lineNumbers} onChange={(v) => setPref('lineNumbers', v)} />
      </Row>

      <Row label="Relative line numbers" hint="Count lines up and down from the cursor, like Vim's relativenumber.">
        <Toggle
          label="Relative line numbers"
          checked={prefs.relativeLineNumbers}
          onChange={(v) => setPref('relativeLineNumbers', v)}
        />
      </Row>

      <Row label="Spell check" hint="Underline misspelled words while you type.">
        <Toggle label="Spell check" checked={prefs.spellcheck} onChange={(v) => setPref('spellcheck', v)} />
      </Row>

      <Row label="Vim mode" hint="Use Vim keys and motions in the editor.">
        <Toggle label="Vim mode" checked={prefs.vimMode} onChange={(v) => setPref('vimMode', v)} />
      </Row>

      {prefs.vimMode && <VimKeymaps />}

      <Row label="Save changes" hint="How long to wait after you stop typing.">
        <Segmented<number>
          value={prefs.autosaveDelay}
          onChange={(v) => setPref('autosaveDelay', v)}
          options={[
            { value: 300, label: 'Quickly' },
            { value: 700, label: 'Normal' },
            { value: 1500, label: 'Relaxed' },
          ]}
        />
      </Row>
    </>
  )
}

function NotesTab() {
  const prefs = useApp((s) => s.prefs)
  const setPref = useApp((s) => s.setPref)
  const [root, setRoot] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.api.settings.getNotesRoot().then(setRoot)
  }, [])

  async function changeFolder() {
    setBusy(true)
    const dir = await window.api.settings.chooseNotesRoot()
    if (!dir) return setBusy(false) // cancelled

    // Clear the open note/notebook: they belong to the old folder
    const s = useApp.getState()
    s.setActiveNote(null)
    s.setActiveAegis(null)
    window.api.settings.relaunch()
  }

  return (
    <>
      <div className="py-3 border-b border-line">
        <div className="text-sm font-medium">Notes folder</div>
        <div className="text-xs text-muted mt-0.5">
          Every notebook is a folder in here. Pick a folder in iCloud Drive or Dropbox to sync your notes.
        </div>
        <code
          title={root}
          className="mt-2 block truncate rounded-md bg-hover px-2 py-1.5 text-xs font-mono"
        >
          {root || '…'}
        </code>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => window.api.settings.revealNotesRoot()}
            className="rounded-md border border-line px-2.5 py-1 text-sm hover:bg-hover"
          >
            Show in Finder
          </button>
          <button
            onClick={changeFolder}
            disabled={busy}
            className="rounded-md bg-accent px-2.5 py-1 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Choosing…' : 'Change folder…'}
          </button>
        </div>
        <div className="mt-1.5 text-[11px] text-muted">The app restarts after you pick a new folder.</div>
      </div>

      <Row label="Sort notes by">
        <Segmented<Prefs['noteSort']>
          value={prefs.noteSort}
          onChange={(v) => setPref('noteSort', v)}
          options={[
            { value: 'updated', label: 'Last edited' },
            { value: 'name', label: 'Name' },
          ]}
        />
      </Row>
    </>
  )
}

function ShortcutsTab() {
  return (
    <div className="divide-y divide-line">
      {SHORTCUTS.map(([keys, action]) => (
        <div key={keys} className="flex items-center justify-between py-2.5 text-sm">
          <span>{action}</span>
          <kbd className="rounded border border-line bg-hover px-1.5 py-0.5 font-mono text-xs text-muted">{keys}</kbd>
        </div>
      ))}
    </div>
  )
}

/* ---------- Modal ---------- */

export default function SettingsModal() {
  const open = useApp((s) => s.settingsOpen)
  const setOpen = useApp((s) => s.setSettingsOpen)
  const resetPrefs = useApp((s) => s.resetPrefs)
  const [tab, setTab] = useState<Tab>('profile')

  // Cmd/Ctrl + , toggles settings, Esc closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isOpen = useApp.getState().settingsOpen
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setOpen(!isOpen)
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  if (!open) return null

  const current = TABS.find((t) => t.id === tab)!

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6 no-drag"
      onMouseDown={() => setOpen(false)}
    >
      <div
        className="flex w-full max-w-2xl h-[min(560px,85vh)] bg-bg text-fg rounded-xl border border-line shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Tabs */}
        <nav className="w-44 shrink-0 bg-side border-r border-line p-2 flex flex-col gap-0.5">
          <div className="px-2 py-2 text-sm font-semibold">Settings</div>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                tab === id ? 'bg-selected text-selected-fg' : 'hover:bg-hover'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
          <button
            onClick={resetPrefs}
            className="mt-auto rounded-md px-2 py-1.5 text-left text-xs text-muted hover:bg-hover hover:text-fg"
          >
            Reset to defaults
          </button>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between px-6 pt-5 pb-2">
            <h2 className="text-lg font-semibold">{current.label}</h2>
            <button onClick={() => setOpen(false)} title="Close (Esc)" className="rounded-md p-1 text-muted hover:bg-hover hover:text-fg">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            {tab === 'profile' && <ProfileTab />}
            {tab === 'appearance' && <AppearanceTab />}
            {tab === 'editor' && <EditorTab />}
            {tab === 'notes' && <NotesTab />}
            {tab === 'shortcuts' && <ShortcutsTab />}
          </div>
        </div>
      </div>
    </div>
  )
}