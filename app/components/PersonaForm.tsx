'use client'
import { useState } from 'react'
import { resolvePersona } from '@/lib/personas'
import type { Persona } from '@/lib/types'

const EXAMPLES = ['a 68-year-old retired farmer who loves tractors', 'a 12-year-old who is into K-pop and drawing', 'a nurse working night shifts', 'a 40-year-old chef curious about chemistry']

const field = 'w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900'

export function PersonaForm({ onSave, onCancel }: { onSave: (p: Persona) => void; onCancel: () => void }) {
  const [description, setDescription] = useState('')
  const [filling, setFilling] = useState(false)
  const [error, setError] = useState('')
  const [f, setF] = useState({ name: '', age: '', interests: '', level: '', tone: '', visualStyle: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function fill() {
    setFilling(true)
    setError('')
    try {
      const r = await fetch('/api/persona', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description }) })
      const p = await r.json()
      if (!r.ok) throw new Error(p.error)
      setF({ name: p.name, age: String(p.age), interests: p.interests.join(', '), level: p.level, tone: p.tone, visualStyle: p.visualStyle })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setFilling(false)
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    try {
      onSave(resolvePersona({ ...f, age: Number(f.age), interests: f.interests.split(',').map(s => s.trim()).filter(Boolean) }))
    } catch {
      setError('Please fill every field: age 3–110, 1–6 interests, and keep each field short.')
    }
  }

  const inputs: [keyof typeof f, string, string][] = [
    ['name', 'Name', 'Maya'],
    ['age', 'Age', '68'],
    ['interests', 'Interests (comma-separated)', 'gardening, cooking'],
    ['level', 'What they already know', 'retired nurse, little physics'],
    ['tone', 'How to talk to them', 'warm, patient, everyday words'],
    ['visualStyle', 'Video style they would enjoy', 'soft watercolor garden scenes'],
  ]

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl border border-indigo-300 p-5 dark:border-indigo-800">
      <h2 className="text-lg font-semibold">Create a persona</h2>
      <div className="space-y-2">
        <label htmlFor="persona-desc" className="text-sm font-medium">
          Describe the learner in one line
        </label>
        <div className="flex gap-2">
          <input id="persona-desc" value={description} onChange={e => setDescription(e.target.value)} maxLength={300} placeholder={EXAMPLES[0]} className={field} />
          <button type="button" onClick={fill} disabled={filling || !description.trim()} className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
            {filling ? 'Filling…' : 'Fill with AI'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {EXAMPLES.map(x => (
            <button key={x} type="button" onClick={() => setDescription(x)} className="rounded-full border border-zinc-300 px-3 py-1 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900">
              {x}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {inputs.map(([k, label, ph]) => (
          <label key={k} className="space-y-1 text-sm">
            <span className="font-medium">{label}</span>
            <input value={f[k]} onChange={set(k)} placeholder={ph} type={k === 'age' ? 'number' : 'text'} className={field} />
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-white dark:bg-white dark:text-black">
          Save persona
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">
          Cancel
        </button>
      </div>
    </form>
  )
}
