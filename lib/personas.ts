import { z } from 'zod'
import type { Persona } from './types'

export const PERSONAS: Persona[] = [
  {
    id: 'ayaan',
    name: 'Ayaan',
    age: 10,
    interests: ['football (soccer)', 'playing in the park', 'cartoons'],
    level: 'primary school, no physics background',
    tone: 'playful, excited, simple words, short sentences',
    visualStyle: 'bright colorful 3D cartoon, sunny football pitch, friendly and fun',
  },
  {
    id: 'sara',
    name: 'Sara',
    age: 19,
    interests: ['machines', 'mechanics', 'building things'],
    level: 'first-year engineering student, knows algebra and basic calculus',
    tone: 'precise, technical, uses correct units and equations',
    visualStyle: 'clean technical 3D render, engineering lab, neutral studio lighting',
  },
  {
    id: 'leo',
    name: 'Leo',
    age: 15,
    interests: ['video games', 'electric guitar', 'skateboarding'],
    level: 'high school, basic algebra, easily bored by textbooks',
    tone: 'casual and energetic, gaming references, short punchy sentences',
    visualStyle: 'neon retro video-game pixel art, arcade colors',
  },
  {
    id: 'priya',
    name: 'Priya',
    age: 32,
    interests: ['running her bakery', 'baking bread', 'weekend cycling'],
    level: 'no science background since school, very practical, busy',
    tone: 'clear and practical, straight to the point, everyday examples',
    visualStyle: 'flat-design infographic, warm bakery colors, clean icons',
  },
  {
    id: 'maya',
    name: 'Maya',
    age: 68,
    interests: ['gardening', 'cooking for her grandchildren', 'birdwatching'],
    level: 'retired nurse, knows the human body well, little physics',
    tone: 'warm, patient, gentle pace, everyday words',
    visualStyle: 'soft watercolor illustration, cozy garden and kitchen',
  },
]

export function getPersona(id: string): Persona {
  const p = PERSONAS.find(p => p.id === id)
  if (!p) throw new Error(`Unknown persona: ${id}`)
  return p
}

const text = (max: number) => z.string().trim().min(1).max(max)

// Custom personas come from the browser (or the AI fill), so every field is bounded before it reaches a prompt
export const PersonaFields = z.object({
  name: text(40),
  age: z.number().int().min(3).max(110),
  interests: z.array(text(40)).min(1).max(6),
  level: text(120),
  tone: text(120),
  visualStyle: text(160),
})

// FNV-1a, so the browser and server derive the same id without node:crypto
function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16).padStart(8, '0')
}

// Built-in personas always come from the server list; a custom one is validated and gets a content-derived id
export function resolvePersona(input: unknown): Persona {
  const seeded = PERSONAS.find(p => p.id === (input as { id?: unknown } | null)?.id)
  if (seeded) return seeded
  const f = PersonaFields.parse(input)
  return { id: `custom-${hash(JSON.stringify(f))}`, ...f }
}
