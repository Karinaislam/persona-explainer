import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import { cacheKey, readScript, writeScript, cacheDir } from '@/lib/cache'
import type { Script } from '@/lib/types'

const q = 'how does gravity work?'

describe('cacheKey', () => {
  it('normalizes case and whitespace', () => {
    expect(cacheKey('sara', 'How does  Gravity work? ')).toBe(cacheKey('sara', q))
  })
  it('differs per persona', () => {
    expect(cacheKey('ayaan', q)).not.toBe(cacheKey('sara', q))
  })
  it('is 12 hex chars', () => {
    expect(cacheKey('sara', q)).toMatch(/^[0-9a-f]{12}$/)
  })
})

describe('script cache', () => {
  const key = cacheKey('test-persona', 'cache roundtrip')
  beforeEach(() => fs.rmSync(cacheDir(key), { recursive: true, force: true }))
  it('round-trips and returns null when missing', () => {
    expect(readScript(key)).toBeNull()
    const s: Script = { answer: { summary: 's', sections: [{ heading: 'h', body: 'b' }], example: 'e', keyPoints: ['k'], takeaway: 't' }, styleBible: 'b', shots: [] }
    writeScript(key, s)
    expect(readScript(key)).toEqual(s)
    fs.rmSync(cacheDir(key), { recursive: true, force: true })
  })
})
