import fs from 'node:fs'
import path from 'node:path'
import OpenAI from 'openai'
import { pipeline, type TextToAudioPipeline } from '@huggingface/transformers'

const ensureDir = (file: string) => fs.mkdirSync(path.dirname(file), { recursive: true })

function client() {
  const { LLM_API_KEY, LLM_BASE_URL } = process.env
  if (!LLM_API_KEY || !LLM_BASE_URL) throw new Error('Set LLM_API_KEY and LLM_BASE_URL (Meta Model API) in .env.local')
  return new OpenAI({ apiKey: LLM_API_KEY, baseURL: LLM_BASE_URL })
}

// Muse Image via the Meta Model API; returns WebP
export async function generateStill(prompt: string, outWebp: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const res = await client().images.generate({ model: process.env.IMAGE_MODEL || 'muse-image-1.0', prompt, n: 1, size: '1792x1024' })
    const b64 = res.data?.[0]?.b64_json
    if (b64) {
      ensureDir(outWebp)
      fs.writeFileSync(outWebp, Buffer.from(b64, 'base64'))
      return
    }
    if (attempt >= 3) throw new Error('Muse Image returned no image')
  }
}

// Meta MMS-TTS (open weights), run locally; one English voice
const g = globalThis as unknown as { __tts?: Promise<TextToAudioPipeline> }
const tts = () => (g.__tts ??= pipeline('text-to-speech', 'Xenova/mms-tts-eng', { dtype: 'fp32' }))

function wav(samples: Float32Array, rate: number): Buffer {
  const pcm = Buffer.alloc(samples.length * 2)
  samples.forEach((s, i) => pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2))
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}

export type VoiceTiming = { starts: number[]; total: number } // seconds

// Voices each scene's narration in order and returns when each scene starts, so video and captions follow the real voice
export async function synthesizeSpeech(scenes: string[], outWav: string): Promise<VoiceTiming> {
  const synth = await tts()
  const parts: Float32Array[] = []
  const starts: number[] = []
  let rate = 16000
  let samples = 0
  const push = (p: Float32Array) => (parts.push(p), (samples += p.length))
  for (const scene of scenes) {
    starts.push(samples / rate)
    // MMS is most stable sentence by sentence; join with a short pause
    for (const s of scene.split(/(?<=[.!?])\s+/).filter(t => t.trim())) {
      const out = await synth(s)
      rate = out.sampling_rate
      push(out.audio as Float32Array)
      push(new Float32Array(Math.round(rate * 0.25)))
    }
  }
  const all = new Float32Array(samples)
  parts.reduce((o, p) => (all.set(p, o), o + p.length), 0)
  ensureDir(outWav)
  fs.writeFileSync(outWav, wav(all, rate))
  return { starts, total: samples / rate }
}
