import { app } from 'electron'
import { join } from 'node:path'
import { getNotesRootOverride } from '../Aegis/settings' // adjust the path if Utils lives elsewhere

export function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err
}

const ROOT_NAME = 'LunaMD'

export function getAegisRoot() {
  return getNotesRootOverride() ?? join(app.getPath('documents'), ROOT_NAME)
}
