import type { Aegis } from './types/aegis.types'

/** Folder inside a notebook where pasted/dropped images are stored. Never shown as a notebook. */
export const ATTACHMENTS_DIR = '_attachments'

/** Every notebook in the tree, parents before their children */
export function flattenAegis(tree: Aegis[]): Aegis[] {
  const out: Aegis[] = []
  const walk = (list: Aegis[]): void => {
    for (const a of list) {
      out.push(a)
      walk(a.children)
    }
  }
  walk(tree)
  return out
}
