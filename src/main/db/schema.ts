import { sqliteTable, integer, text, primaryKey } from 'drizzle-orm/sqlite-core'

export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  path: text('path').notNull().unique(),
  title: text('title').notNull(),
  hash: text('hash').notNull(),
  mtimeMs: integer('mtime_ms').notNull(),
  size: integer('size').notNull(),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  lastOpenedAt: integer('last_opened_at')
})

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique()
})

export const noteTags = sqliteTable(
  'note_tags',
  {
    noteId: integer('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' })
  },
  (t) => [primaryKey({ columns: [t.noteId, t.tagId] })]
)

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
})

export type Note = typeof notes.$inferSelect
export type NewNote = typeof notes.$inferInsert
