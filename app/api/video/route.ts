import { resolvePersona } from '@/lib/personas'
import { readScript } from '@/lib/cache'
import { renderVideo } from '@/lib/pipeline'
import { startJob } from '@/lib/jobs'
import { bad, isKey } from '@/lib/http'

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
  if (!script) return bad('Ask the question first', 404)
  startJob(key, onStep => renderVideo(key, persona, script, {}, onStep))
  return Response.json({ state: 'pending' })
}
