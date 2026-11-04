export type Caption = { text: string; start: number; end: number }

const MAX_WORDS = 7
const MAX_CHARS = 48 // fits one line at the caption font size on 1280px

// Split narration into one-line captions, timed by character share of the voice track.
// shortcut: timing is estimated, not word-aligned; upgrade to a speech-to-text alignment if captions drift visibly.
export function captionChunks(narration: string, totalSec: number): Caption[] {
  const lines: string[] = []
  let cur: string[] = []
  for (const word of narration.trim().split(/\s+/).filter(Boolean)) {
    if (cur.length && (cur.length >= MAX_WORDS || [...cur, word].join(' ').length > MAX_CHARS)) {
      lines.push(cur.join(' '))
      cur = []
    }
    cur.push(word)
    if (/[.!?]$/.test(word)) {
      lines.push(cur.join(' '))
      cur = []
    }
  }
  if (cur.length) lines.push(cur.join(' '))

  const total = lines.reduce((n, l) => n + l.length, 0)
  let t = 0
  return lines.map(text => {
    const start = t
    t += (text.length / total) * totalSec
    return { text, start, end: t }
  })
}
