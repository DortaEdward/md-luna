import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq } from 'drizzle-orm'
import * as schema from './schema'

const sqlite = new Database(join(app.getPath('userData'), 'luna.db'))
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

export function runMigrations(): void {
  const migrationsFolder = app.isPackaged
    ? join(process.resourcesPath, 'drizzle')
    : join(app.getAppPath(), 'drizzle')
  migrate(db, { migrationsFolder })
}

export const closeDb = (): void => {
  sqlite.close()
}

export const getSetting = (key: string): string | undefined =>
  db.select().from(schema.settings).where(eq(schema.settings.key, key)).get()?.value

export const setSetting = (key: string, value: string): void => {
  db.insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } })
    .run()
}
