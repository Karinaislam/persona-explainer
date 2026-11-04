import { generatePersona } from '@/lib/llama'
import { bad } from '@/lib/http'

// Muse Spark turns a one-line description into a full learner persona
export async function POST(req: Request) {
  const { description } = await req.json().catch(() => ({}))
  if (typeof description !== 'string' || !description.trim() || description.length > 300) return bad('Description must be 1-300 characters')
  try {
    return Response.json(await generatePersona(description.trim()))
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Persona generation failed', 502)
  }
}
