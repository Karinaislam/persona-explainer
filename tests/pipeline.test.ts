import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderVideo } from '@/lib/pipeline'
import { cacheDir, cacheKey } from '@/lib/cache'
import { getPersona } from '@/lib/personas'
import type { Script } from '@/lib/types'

const touch = (f: string) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, '') }
const script: Script = {
  answer: { summary: 's', sections: [{ heading: 'h', body: 'b' }], example: 'e', keyPoints: ['k'], takeaway: 't' }, styleBible: 'cartoon',
  shots: [0, 1, 2, 3].map(i => ({ visualPrompt: `p${i}`, narration: `n${i}`, overlay: i % 2 ? 'F = m·g' : undefined })),
}

let key: string
// the fake voice speaks scene i from 5i seconds on, 20s in total
const fakes = (timing = { starts: [0, 5, 10, 15], total: 20 }) => ({
  generateStill: vi.fn(async (_p: string, out: string) => touch(out)),
  synthesizeSpeech: vi.fn(async (_t: string[], out: string) => (touch(out), timing)),
  runFfmpeg: vi.fn(async (args: string[]) => touch(args[args.length - 1])),
})
const stitchArgs = (d: ReturnType<typeof fakes>) => d.runFfmpeg.mock.calls.map(c => c[0]).find(a => a.includes('-filter_complex'))!
const sceneSecs = (a: string[]) => [...a[a.indexOf('-filter_complex') + 1].matchAll(/trim=duration=([\d.]+)/g)].map(m => Number(m[1]))
const total = (a: string[]) => Number(a[a.indexOf('-t') + 1])

beforeEach(() => {
  key = cacheKey('test', String(Math.random()))
})
afterEach(() => fs.rmSync(cacheDir(key), { recursive: true, force: true }))

describe('renderVideo', () => {
  it('draws each scene with Muse Image and voices the narration scene by scene', async () => {
    const d = fakes()
    const out = await renderVideo(key, getPersona('ayaan'), script, { ...d })
    expect(fs.existsSync(out)).toBe(true)
    expect(d.generateStill).toHaveBeenCalledTimes(4)
    expect(d.synthesizeSpeech).toHaveBeenCalledWith(['n0', 'n1', 'n2', 'n3'], expect.any(String))
  })
  it('has the image draw each title and keep the bottom clear for captions', async () => {
    const d = fakes()
    await renderVideo(key, getPersona('ayaan'), script, { ...d })
    const prompts = d.generateStill.mock.calls.map(c => c[0])
    expect(prompts[1]).toContain('"F = m·g"')
    for (const p of prompts) expect(p.toLowerCase()).toContain('bottom')
  })
  it('returns the cached video without calling anything', async () => {
    await renderVideo(key, getPersona('ayaan'), script, { ...fakes() })
    const again = fakes()
    await renderVideo(key, getPersona('ayaan'), script, { ...again })
    for (const f of Object.values(again)) expect(f).not.toHaveBeenCalled()
  })
  it('reuses an existing voiceover and its timing instead of recording it again', async () => {
    await renderVideo(key, getPersona('ayaan'), script, { ...fakes() })
    fs.rmSync(path.join(cacheDir(key), 'final.mp4'))
    const d = fakes()
    await renderVideo(key, getPersona('ayaan'), script, { ...d })
    expect(d.synthesizeSpeech).not.toHaveBeenCalled()
    expect(sceneSecs(stitchArgs(d))).toEqual([5, 5, 5, 5.5])
  })
  it('records the voice again when its timing file is missing', async () => {
    touch(path.join(cacheDir(key), 'scenes', 'voice.wav'))
    const d = fakes()
    await renderVideo(key, getPersona('ayaan'), script, { ...d })
    expect(d.synthesizeSpeech).toHaveBeenCalledTimes(1)
  })
})

describe('renderVideo timing follows the real voice', () => {
  it('makes each scene last exactly as long as its own narration', async () => {
    const d = fakes({ starts: [0, 3.2, 10.1, 12], total: 18.4 })
    await renderVideo(key, getPersona('sara'), script, { ...d })
    expect(sceneSecs(stitchArgs(d))).toEqual([3.2, 6.9, 1.9, 6.9])
  })
  it('ends the video just after the narration', async () => {
    const d = fakes({ starts: [0, 5, 10, 15], total: 22.6 })
    await renderVideo(key, getPersona('ayaan'), script, { ...d })
    expect(total(stitchArgs(d))).toBeCloseTo(23.1, 1)
  })
  it('times each caption inside its own scene', async () => {
    const d = fakes({ starts: [0, 5, 10, 15], total: 20 })
    await renderVideo(key, getPersona('sara'), script, { ...d })
    const filter = stitchArgs(d)[stitchArgs(d).indexOf('-filter_complex') + 1]
    const windows = [...filter.matchAll(/gte\(t,([\d.]+)\)\*lt\(t,([\d.]+)\)/g)].map(m => Number(m[1]))
    expect(windows).toEqual([0, 5, 10, 15])
    expect(fs.readFileSync(path.join(cacheDir(key), 'scenes', 'caption-1.txt'), 'utf8')).toBe('n1')
  })
})
