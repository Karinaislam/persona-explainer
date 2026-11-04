import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { cacheDir, videoPath } from './cache'
import type { Persona, Script } from './types'

const SceneCheck = z.object({ scene: z.number(), score: z.number().min(0).max(10), issue: z.string() })
const WonderReview = z.object({ score: z.number().min(0).max(10), summary: z.string().min(1), scenes: z.array(SceneCheck) })
export type WonderReview = z.infer<typeof WonderReview>
export type Review = { voiceAccuracy: number; heard: string; wonder: WonderReview }

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, ' ').split(/\s+/).filter(Boolean)

// 1 - word error rate (word-level edit distance), clamped to 0..1
export function wordAccuracy(expected: string, heard: string): number {
  const a = words(expected)
  const b = words(heard)
  if (!a.length) return 1
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return Math.max(0, 1 - prev[b.length] / a.length)
}

export function parseWonderReview(raw: string): WonderReview {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  return WonderReview.parse(JSON.parse(text))
}

const auth = () => {
  const { LLM_API_KEY, LLM_BASE_URL } = process.env
  if (!LLM_API_KEY || !LLM_BASE_URL) throw new Error('Set LLM_API_KEY and LLM_BASE_URL (Meta Model API) in .env.local')
  return { base: LLM_BASE_URL, headers: { Authorization: `Bearer ${LLM_API_KEY}` } }
}

// Muse Voice Transcribe: listen to our own narration
async function transcribe(wavPath: string): Promise<string> {
  const { base, headers } = auth()
  const form = new FormData()
  form.append('request', new Blob([JSON.stringify({ mode: 'ENDPOINTING', model: 'muse-voice-transcribe-1.0', audioEncoding: 'WAV' })], { type: 'application/json' }))
  form.append('audio', new Blob([fs.readFileSync(wavPath)], { type: 'audio/wav' }), 'voice.wav')
  const r = await fetch(`${base}/asr/transcribe`, { method: 'POST', headers, body: form })
  if (!r.ok) throw new Error(`Muse Voice Transcribe failed: ${r.status} ${await r.text()}`)
  return ((await r.json()) as { transcript?: string }).transcript ?? ''
}

// Muse Wonder: watch the finished video and check it against the script
async function watch(mp4Path: string, persona: Persona, script: Script): Promise<WonderReview> {
  const { base, headers } = auth()
  const plan = script.shots
    .map((s, i) => `Scene ${i + 1}\n- Title: ${s.overlay ?? '(none)'}\n- Narration: ${s.narration}\n- Intended visual: ${s.visualPrompt}`)
    .join('\n\n')
  const prompt = `You are the quality reviewer for a 4-scene explainer video made for ${persona.name}, age ${persona.age} (${persona.level}; interests: ${persona.interests.join(', ')}).

Watch the video and compare it with the plan below. For each scene, score 0-10 how well the visuals, on-screen text and captions match the plan, are correct and readable, and suit this learner. Note any concrete problem (wrong object, misspelled or wrong text, fact error, caption covering content, off-persona detail); use "" when there is none.

${plan}

Return only JSON: {"score": number, "summary": string (2 sentences), "scenes": [{"scene": number, "score": number, "issue": string}]}`
  let last: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.REVIEW_MODEL || 'muse-wonder-1.0',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'video_url', video_url: { url: `data:video/mp4;base64,${fs.readFileSync(mp4Path).toString('base64')}` } },
            ],
          },
        ],
      }),
    })
    if (!r.ok) throw new Error(`Muse Wonder failed: ${r.status} ${await r.text()}`)
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] }
    try {
      return parseWonderReview(j.choices?.[0]?.message?.content ?? '')
    } catch (e) {
      last = e
    }
  }
  throw last
}

export async function reviewVideo(key: string, persona: Persona, script: Script): Promise<Review> {
  const file = path.join(cacheDir(key), 'review.json')
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'))
  const [heard, wonder] = await Promise.all([transcribe(path.join(cacheDir(key), 'scenes', 'voice.wav')), watch(videoPath(key), persona, script)])
  const review: Review = { voiceAccuracy: wordAccuracy(script.shots.map(s => s.narration).join(' '), heard), heard, wonder }
  fs.writeFileSync(file, JSON.stringify(review, null, 2))
  return review
}
