import { EditorView } from '@codemirror/view'

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    width: '100%',
    fontSize: 'var(--editor-font-size, 14px)', // set from Settings → Appearance
    color: 'inherit', // follows text-fg, so it switches with the theme
    backgroundColor: 'transparent',
  },
  '.cm-scroller': {
    overflowY: 'auto',
    overflowX: 'hidden', // never scroll sideways, wrap instead
    fontFamily: 'var(--editor-font, ui-monospace, monospace)', // set from Settings → Appearance
    lineHeight: '1.6',
  },
  '.cm-content': {
    padding: '16px 12px', // horizontal padding: change 12px to taste
    caretColor: 'currentColor',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere', // also breaks long URLs / unbroken strings
  },
  '.cm-line': {
    padding: '0', // remove CodeMirror's default 6px line indent
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'currentColor',
  },

  // Selection: matches CodeMirror's own selectors so this colour actually wins
  '.cm-selectionLayer .cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground':
    {
      backgroundColor: 'color-mix(in oklab, var(--accent) 28%, transparent)',
    },
  '.cm-content ::selection': {
    backgroundColor: 'color-mix(in oklab, var(--accent) 28%, transparent)',
  },

  // Vim normal-mode block cursor
  '.cm-fat-cursor': {
    background: 'color-mix(in oklab, var(--accent) 70%, transparent) !important',
    color: 'inherit !important',
    outline: 'none !important',
  },
  '&:not(.cm-focused) .cm-fat-cursor': {
    background: 'none !important',
    outline: '1px solid color-mix(in oklab, var(--accent) 70%, transparent) !important',
  },
  // Vim command line (:w, /search) shown at the bottom
  '.cm-vim-panel': {
    padding: '2px 12px',
    fontFamily: 'var(--editor-font, ui-monospace, monospace)',
    backgroundColor: 'transparent',
  },
  '.cm-vim-panel input': {
    color: 'inherit',
    backgroundColor: 'transparent',
  },
  '.cm-panels': {
    backgroundColor: 'transparent',
    color: 'inherit',
    borderTop: '1px solid var(--fg-faint)',
  },

  // Line numbers: faint, with the cursor's line brighter
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 10px 0 12px',
    minWidth: '2ch',
    fontVariantNumeric: 'tabular-nums',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--fg-muted)',
  },

  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--fg-faint)',
    border: 'none',
  },
  '&.cm-focused': {
    outline: 'none',
  },
})

export default editorTheme