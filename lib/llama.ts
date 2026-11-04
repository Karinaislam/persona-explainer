import OpenAI from 'openai'
import { z } from 'zod'
import type { Persona, Script } from './types'
import { resolvePersona } from './personas'

export class ScriptError extends Error {}

const ScriptSchema = z.object({
  answer: z.object({
    summary: z.string().min(1),
    sections: z.array(z.object({ heading: z.string().min(1), body: z.string().min(1) })).min(3).max(6),
    example: z.string().min(1),
    keyPoints: z.array(z.string().min(1)).min(2).max(6),
    takeaway: z.string().min(1),
  }),
  styleBible: z.string().min(1),
  shots: z
    .array(z.object({ visualPrompt: z.string().min(1), narration: z.string().min(1), overlay: z.string().optional() }))
    .length(4),
})

export function buildPrompt(persona: Persona, question: string): { system: string; user: string } {
  const system = `You explain things to one specific learner and also write a 30-second infographic explainer video for them.

Learner:
- Name: ${persona.name}, age ${persona.age}
- Interests: ${persona.interests.join(', ')}
- Level: ${persona.level}
- Tone: ${persona.tone}
- Visual style: ${persona.visualStyle}

Rules:
- Use analogies from the learner's interests. Match their level and tone.
- Be scientifically accurate: double-check every claim, avoid popular misconceptions, never use an analogy that teaches something false, and use realistic real-world values (e.g. a football weighs about 0.43 kg).
- Keep the math at the learner's level: without algebra, explain with words and simple whole numbers, no formulas; with algebra, show the equations with units.
- "answer": a detailed, well-structured lesson, written as a great teacher would for this exact learner:
  - "summary": 2-3 sentences that answer the question directly.
  - "sections": 3-5 sections that teach the topic in a logical order (e.g. what it is, how and why it works, the key law/mechanism with its math at the learner's level, what affects it, where it shows up in real life, a common misconception). Each has a short "heading" and a "body" of 80-150 words that explains with reasons, cause and effect, and concrete details, not just facts. Separate paragraphs in a body with a blank line.
  - "example": a worked example of 60-120 words built on the learner's interests, walking through it step by step (with real numbers and units if the learner's level allows).
  - "keyPoints": 3-5 one-sentence recap points.
  - "takeaway": one memorable sentence to remember.
  - Write math with Unicode (², ·, ₁, ≈, →), never LaTeX.
- "styleBible": one sentence describing an animated infographic look in the visual style above (palette, recurring character/object, diagram style).
- "shots": exactly 4 shots, about 8 seconds each, building the explanation step by step.
  - "narration": about 17 words (about 70 words total across all 4 shots), spoken by a text-to-speech narrator. Write it fully in words: spell out numbers, units and symbols (e.g. "nine point eight metres per second squared", not "9.8 m/s²").
  - "visualPrompt": a prompt for an AI image model describing an infographic scene. Start it with the styleBible. Show the idea visually with diagrams, labeled arrows, icons, simple charts or cut-away views, At most 3 short word labels (1-3 words each), spelled out exactly in quotes. Never put equations, formulas or numbers in the visualPrompt; they belong in "overlay". No paragraphs of text.
  - "overlay": the key fact or equation for this shot (e.g. "F = m·g"), max 40 characters. It is drawn as the title at the top of the scene.

Return only JSON: {"answer": {"summary": string, "sections": [{"heading": string, "body": string}], "example": string, "keyPoints": string[], "takeaway": string}, "styleBible": string, "shots": [{"visualPrompt": string, "narration": string, "overlay"?: string}]}`
  return { system, user: question }
}

export const isCurrentScript = (x: unknown): x is Script => ScriptSchema.safeParse(x).success

export function parseScript(raw: string): Script {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new ScriptError('Llama did not return JSON')
  }
  const r = ScriptSchema.safeParse(json)
  if (!r.success) throw new ScriptError(`Invalid script: ${r.error.message}`)
  return r.data
}

type Complete = (system: string, user: string) => Promise<string>

const llamaComplete: Complete = async (system, user) => {
  const { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, LLM_API } = process.env
  if (!LLM_API_KEY || !LLM_BASE_URL || !LLM_MODEL) throw new Error('Set LLM_API_KEY, LLM_BASE_URL and LLM_MODEL in .env.local')
  // Any OpenAI-compatible provider (Llama API, Meta Model API / Muse Spark); no response_format, since not every provider accepts it
  const client = new OpenAI({ apiKey: LLM_API_KEY, baseURL: LLM_BASE_URL })
  if (LLM_API === 'responses') {
    const res = await client.responses.create({ model: LLM_MODEL, instructions: system, input: user })
    return res.output_text
  }
  const res = await client.chat.completions.create({
    model: LLM_MODEL,
    // optional: reasoning models give more accurate answers with more effort
    ...(process.env.LLM_REASONING_EFFORT && { reasoning_effort: process.env.LLM_REASONING_EFFORT as 'low' | 'medium' | 'high' }),
    // reasoning tokens count against this; small provider defaults (e.g. 3072) leave no room for the answer
    max_completion_tokens: 16000,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  })
  return res.choices[0]?.message?.content ?? ''
}

export async function generateScript(persona: Persona, question: string, complete: Complete = llamaComplete): Promise<Script> {
  const { system, user } = buildPrompt(persona, question)
  let last: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return parseScript(await complete(system, user))
    } catch (e) {
      if (!(e instanceof ScriptError)) throw e
      last = e
    }
  }
  throw last
}

const PERSONA_PROMPT = `You create a learner persona for a personalized teaching app from a short description.
Fill in anything the description leaves open with realistic, specific details that make the learner distinct.
Return only JSON: {"name": string (first name), "age": number, "interests": string[] (2-4 short items), "level": string (what they already know, max 120 chars), "tone": string (how to talk to them, max 120 chars), "visualStyle": string (an illustration style they would enjoy, max 160 chars)}`

export async function generatePersona(description: string, complete: Complete = llamaComplete): Promise<Persona> {
  let last: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = (await complete(PERSONA_PROMPT, description)).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    try {
      return resolvePersona({ ...JSON.parse(raw), id: undefined })
    } catch (e) {
      last = new ScriptError(`Invalid persona: ${e instanceof Error ? e.message : e}`)
    }
  }
  throw last
}
