export const CH = {
  ITEM_MENU: 'menu:item',
  FS_CHANGED: 'fs:changed',
  RENAME_REQUEST:'item:rename-request',
} as const

export interface Note {
  name: string
  path: string
  preview: string
  updatedAt: number
  tags?: string[]
}

export type NoteView = 'aegis' | 'all' | 'favorites' | 'tag'

