import { describe, it, expect, vi } from 'vitest'
import { parseScript, buildPrompt, generateScript, generatePersona, isCurrentScript, ScriptError } from '@/lib/llama'
import { getPersona } from '@/lib/personas'

const shot = (i: number) => ({ visualPrompt: `scene ${i}`, narration: `line ${i}`, overlay: 'F = m·g' })
const sections = [
  { heading: 'What gravity is', body: 'Every mass pulls on every other mass.' },
  { heading: 'How strong it is', body: 'The pull follows F = G·m₁·m₂/r².' },
  { heading: 'Gravity on Earth', body: 'Near the surface everything accelerates at 9.8 m/s².' },
]
const answer = { summary: 'Gravity pulls.', sections, example: 'A kicked ball falls back.', keyPoints: ['Mass attracts mass', 'Earth pulls at 9.8 m/s²'], takeaway: 'What goes up comes down.' }
const valid = (n = 4, a: unknown = answer) => JSON.stringify({ answer: a, styleBible: 'cartoon', shots: Array.from({ length: n }, (_, i) => shot(i)) })
const q = 'How does gravity work?'

describe('parseScript', () => {
  it('accepts JSON wrapped in code fences', () => {
    expect(parseScript('```json\n' + valid() + '\n```').shots).toHaveLength(4)
  })
  it('rejects 3 or 5 shots', () => {
    expect(() => parseScript(valid(3))).toThrow(ScriptError)
    expect(() => parseScript(valid(5))).toThrow(ScriptError)
  })
  it('rejects a shot missing narration', () => {
    const s = JSON.parse(valid())
    delete s.shots[1].narration
    expect(() => parseScript(JSON.stringify(s))).toThrow(ScriptError)
  })
  it('rejects an unstructured answer or one without key points', () => {
    expect(() => parseScript(valid(4, 'Gravity pulls.'))).toThrow(ScriptError)
    expect(() => parseScript(valid(4, { ...answer, keyPoints: [] }))).toThrow(ScriptError)
  })
  it('requires at least 3 explanatory sections, each with a heading and body', () => {
    expect(() => parseScript(valid(4, { ...answer, sections: sections.slice(0, 2) }))).toThrow(ScriptError)
    expect(() => parseScript(valid(4, { ...answer, sections: [...sections.slice(0, 2), { heading: 'x', body: '' }] }))).toThrow(ScriptError)
  })
  it('rejects non-JSON', () => {
    expect(() => parseScript('Sure! Here is your script.')).toThrow(ScriptError)
  })
})

describe('buildPrompt', () => {
  it('includes persona interests and the rules', () => {
    const { system } = buildPrompt(getPersona('ayaan'), q)
    expect(system).toContain('football')
    expect(system).toContain('4')
    expect(system.toLowerCase()).toContain('infographic')
    expect(system).toContain('70 words')
    expect(system).toContain('keyPoints')
    expect(system).toContain('sections')
  })
})

describe('generateScript', () => {
  it('retries until valid', async () => {
    const complete = vi.fn().mockResolvedValueOnce('junk').mockResolvedValueOnce('junk').mockResolvedValueOnce(valid())
    const s = await generateScript(getPersona('sara'), q, complete)
    expect(s.answer.summary).toBe('Gravity pulls.')
    expect(complete).toHaveBeenCalledTimes(3)
  })
  it('gives up after 3 attempts', async () => {
    const complete = vi.fn().mockResolvedValue('junk')
    await expect(generateScript(getPersona('sara'), q, complete)).rejects.toThrow(ScriptError)
    expect(complete).toHaveBeenCalledTimes(3)
  })
})

describe('isCurrentScript', () => {
  it('accepts a script in the current format', () => {
    expect(isCurrentScript(JSON.parse(valid()))).toBe(true)
  })
  it('rejects scripts cached in older answer formats', () => {
    expect(isCurrentScript(JSON.parse(valid(4, 'plain text')))).toBe(false)
    const noSections = { ...answer, sections: undefined }
    expect(isCurrentScript(JSON.parse(valid(4, noSections)))).toBe(false)
  })
})

describe('generatePersona', () => {
  const persona = { name: 'Leo', age: 15, interests: ['gaming', 'guitar'], level: 'high school, basic algebra', tone: 'casual and energetic', visualStyle: 'neon pixel-art' }
  it('fills a persona from a description, retrying invalid replies', async () => {
    const complete = vi.fn().mockResolvedValueOnce('not json').mockResolvedValueOnce('```json\n' + JSON.stringify(persona) + '\n```')
    const p = await generatePersona('a teen gamer who plays guitar', complete)
    expect(p.name).toBe('Leo')
    expect(p.id).toMatch(/^custom-/)
    expect(complete.mock.calls[0][1]).toContain('teen gamer')
  })
  it('gives up after 3 invalid replies', async () => {
    const complete = vi.fn().mockResolvedValue(JSON.stringify({ ...persona, age: 999 }))
    await expect(generatePersona('x', complete)).rejects.toThrow(ScriptError)
    expect(complete).toHaveBeenCalledTimes(3)
  })
})
