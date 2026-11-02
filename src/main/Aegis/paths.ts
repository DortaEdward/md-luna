import path from 'node:path'
import { getAegisRoot } from '../Utils'

export function inRoot(p: string): string {
  const root = path.resolve(getAegisRoot())
  const abs = path.resolve(p)
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error(`Path outside Aegis root: ${p}`)
  }
  return abs
}