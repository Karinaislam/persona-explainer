import { resolvePersona } from '@/lib/personas'
import { cacheKey, readScript, writeScript } from '@/lib/cache'
import { generateScript, isCurrentScript } from '@/lib/llama'
import { bad } from '@/lib/http'

export async function POST(req: Request) {
  const { persona: personaInput, question } = await req.json().catch(() => ({}))
  if (typeof question !== 'string' || !question.trim() || question.length > 300) return bad('Question must be 1-300 characters')
  let persona
  try {
    persona = resolvePersona(personaInput)
  } catch {
    return bad('Invalid persona')
  }
  const key = cacheKey(persona.id, question)
  const cached = readScript(key)
  // scripts cached in an older format get regenerated
  if (isCurrentScript(cached)) return Response.json({ key, script: cached, cached: true })
  try {
    const script = await generateScript(persona, question)
    writeScript(key, script)
    return Response.json({ key, script, cached: false })
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Script generation failed', 502)
  }
}
