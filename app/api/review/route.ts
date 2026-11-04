import fs from 'node:fs'
import { resolvePersona } from '@/lib/personas'
import { readScript, videoPath } from '@/lib/cache'
import { reviewVideo } from '@/lib/review'
import { bad, isKey } from '@/lib/http'

// Muse Voice Transcribe + Muse Wonder check a finished video; cached after the first run
export async function POST(req: Request) {
  const { key, persona: personaInput } = await req.json().catch(() => ({}))
  if (!isKey(key)) return bad('Invalid key')
  let persona
  try {
    persona = resolvePersona(personaInput)
  } catch {
    return bad('Invalid persona')
  }
  const script = readScript(key)
  if (!script || !fs.existsSync(videoPath(key))) return bad('Render the video first', 404)
  try {
    return Response.json(await reviewVideo(key, persona, script))
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Review failed', 502)
  }
}
