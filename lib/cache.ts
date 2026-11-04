import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Script } from './types'

export function cacheKey(personaId: string, question: string): string {
  const q = question.trim().toLowerCase().replace(/\s+/g, ' ')
  return crypto.createHash('sha1').update(`${personaId}|${q}`).digest('hex').slice(0, 12)
}

export const cacheDir = (key: string) => path.join(process.cwd(), 'data', 'cache', key)

export const videoPath = (key: string) => path.join(cacheDir(key), 'final.mp4')

export function readScript(key: string): Script | null {
  const file = path.join(cacheDir(key), 'script.json')
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
}

export function writeScript(key: string, script: Script): void {
  fs.mkdirSync(cacheDir(key), { recursive: true })
  fs.writeFileSync(path.join(cacheDir(key), 'script.json'), JSON.stringify(script, null, 2))
}
