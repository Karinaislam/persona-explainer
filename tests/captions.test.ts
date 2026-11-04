import { describe, it, expect } from 'vitest'
import { captionChunks } from '@/lib/captions'

const text = 'Gravity pulls every mass toward every other mass. On Earth, that pull gives a steady acceleration of nine point eight metres per second squared, which you feel as weight.'

describe('captionChunks', () => {
  const chunks = captionChunks(text, 12)
  it('keeps every word, in order', () => {
    expect(chunks.map(c => c.text).join(' ')).toBe(text)
  })
  it('keeps each chunk short enough to fit on one line', () => {
    for (const c of chunks) {
      expect(c.text.split(' ').length).toBeLessThanOrEqual(7)
      expect(c.text.length).toBeLessThanOrEqual(48)
    }
  })
  it('covers the whole narration back to back', () => {
    expect(chunks[0].start).toBe(0)
    expect(chunks[chunks.length - 1].end).toBeCloseTo(12)
    for (let i = 1; i < chunks.length; i++) expect(chunks[i].start).toBeCloseTo(chunks[i - 1].end)
  })
  it('breaks after sentence punctuation instead of mid-sentence', () => {
    expect(chunks.some(c => c.text.endsWith('mass.'))).toBe(true)
  })
  it('returns nothing for empty narration', () => {
    expect(captionChunks('  ', 10)).toEqual([])
  })
})
