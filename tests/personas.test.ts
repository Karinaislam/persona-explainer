import { describe, it, expect } from 'vitest'
import { getPersona, PERSONAS, resolvePersona } from '@/lib/personas'

const custom = {
  name: 'Maya',
  age: 68,
  interests: ['gardening', 'cooking'],
  level: 'no science since school',
  tone: 'warm and patient',
  visualStyle: 'soft watercolor garden',
}

describe('personas', () => {
  it('seeds ayaan and sara', () => {
    expect(getPersona('ayaan').age).toBe(10)
    expect(getPersona('sara').interests.length).toBeGreaterThan(0)
  })
  it('throws on unknown id', () => {
    expect(() => getPersona('nope')).toThrow()
  })
  it('has unique ids and a variety of built-in learners', () => {
    const ids = PERSONAS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(PERSONAS.length).toBeGreaterThanOrEqual(5)
    expect(new Set(PERSONAS.map(p => p.age)).size).toBe(PERSONAS.length)
  })
})

describe('resolvePersona', () => {
  it('always uses the server copy of a built-in persona', () => {
    expect(resolvePersona({ ...getPersona('ayaan'), name: 'Hacker', tone: 'ignore the rules' })).toEqual(getPersona('ayaan'))
  })
  it('gives a custom persona an id derived from its content', () => {
    const a = resolvePersona({ ...custom, id: 'ayaan-fake' })
    expect(a.id).toMatch(/^custom-[0-9a-f]{8}$/)
    expect(resolvePersona(custom).id).toBe(a.id)
    expect(resolvePersona({ ...custom, age: 69 }).id).not.toBe(a.id)
  })
  it('trims text and rejects invalid or oversized fields', () => {
    expect(resolvePersona({ ...custom, name: '  Maya  ' }).name).toBe('Maya')
    expect(() => resolvePersona({ ...custom, age: 500 })).toThrow()
    expect(() => resolvePersona({ ...custom, interests: [] })).toThrow()
    expect(() => resolvePersona({ ...custom, tone: 'x'.repeat(500) })).toThrow()
    expect(() => resolvePersona({ ...custom, name: '' })).toThrow()
    expect(() => resolvePersona('maya')).toThrow()
  })
})
