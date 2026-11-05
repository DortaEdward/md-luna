import type { EditorView } from '@codemirror/view'

/*
 * The note editor that's currently open. The preview uses it to run Vim
 * commands (:Split, :w, ...) and to jump back into the editor, even while the
 * editor itself is hidden in Preview mode.
 */
let current: EditorView | null = null

export function setActiveEditor(view: EditorView | null): void {
  current = view
}

export function getActiveEditor(): EditorView | null {
  return current
}

/** Put the cursor back in the editor once it's visible again */
export function focusEditorSoon(): void {
  requestAnimationFrame(() => requestAnimationFrame(() => current?.focus()))
}
