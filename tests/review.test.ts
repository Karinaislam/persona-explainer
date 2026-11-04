import { describe, it, expect } from 'vitest'
import { wordAccuracy, parseWonderReview } from '@/lib/review'

describe('wordAccuracy', () => {
  it('is 1 for a perfect read, ignoring case and punctuation', () => {
    expect(wordAccuracy('Gravity pulls, always!', 'gravity pulls always')).toBe(1)
  })
  it('drops with each missed or wrong word', () => {
    expect(wordAccuracy('sunlight looks white but it is all colors', 'sunlight looks like but it is all colors')).toBeCloseTo(7 / 8)
    expect(wordAccuracy('one two three four', 'one three four')).toBeCloseTo(3 / 4)
  })
  it('never goes below 0 even when the transcript is much longer', () => {
    expect(wordAccuracy('hi', 'a b c d e f')).toBe(0)
  })
  it('is 0 when nothing was heard', () => {
    expect(wordAccuracy('hello there', '')).toBe(0)
  })
})

describe('parseWonderReview', () => {
  const ok = { score: 8, summary: 'Mostly matches.', scenes: [{ scene: 1, score: 9, issue: '' }, { scene: 2, score: 6, issue: 'Shows an American football.' }] }
  it('accepts a review, even wrapped in code fences', () => {
    expect(parseWonderReview('```json\n' + JSON.stringify(ok) + '\n```').scenes[1].issue).toContain('American')
  })
  it('rejects scores outside 0-10 and non-JSON', () => {
    expect(() => parseWonderReview(JSON.stringify({ ...ok, score: 11 }))).toThrow()
    expect(() => parseWonderReview('The video looks great!')).toThrow()
  })
})
