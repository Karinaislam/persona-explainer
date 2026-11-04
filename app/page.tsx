'use client'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { PERSONAS, resolvePersona } from '@/lib/personas'
import { PRESETS } from '@/lib/presets'
import { PersonaSwitcher } from './components/PersonaSwitcher'
import { PersonaForm } from './components/PersonaForm'
import { PresetButtons } from './components/PresetButtons'
import { VideoPanel } from './components/VideoPanel'
import { AnswerView } from './components/AnswerView'
import { VideoScript } from './components/VideoScript'
import type { Persona, Script } from '@/lib/types'

type Result = { key: string; script: Script; persona: Persona }

// custom personas live in this browser only; anything stored that no longer validates is dropped
const STORE = 'customPersonas'
const readStore = () => {
  try {
    return localStorage.getItem(STORE) ?? '[]'
  } catch {
    return '[]'
  }
}
const subscribe = (cb: () => void) => (window.addEventListener('storage', cb), () => window.removeEventListener('storage', cb))
function parseCustom(raw: string): Persona[] {
  try {
    return (JSON.parse(raw) as unknown[]).flatMap(p => {
      try {
        return [resolvePersona(p)]
      } catch {
        return []
      }
    })
  } catch {
    return []
  }
}
function saveCustom(list: Persona[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(list))
  } catch {}
}

export default function Home() {
  const [personaId, setPersonaId] = useState(PERSONAS[0].id)
  const raw = useSyncExternalStore(subscribe, readStore, () => '[]')
  const custom = useMemo(() => parseCustom(raw), [raw])
  const [, rerender] = useState(0)
  const [creating, setCreating] = useState(false)
  const personas = [...PERSONAS, ...custom]
  const persona = personas.find(p => p.id === personaId) ?? PERSONAS[0]

  function updateCustom(list: Persona[]) {
    saveCustom(list)
    rerender(n => n + 1) // same-tab writes don't fire 'storage'; re-render re-reads the store
  }
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)

  async function ask(q: string) {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ persona, question: q }) })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setResult({ key: data.key, script: data.script, persona })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold">Persona Explainer</h1>
        <p className="text-zinc-500">Same question, explained for who you are: a lesson, a narrated explainer video and its script.</p>
      </header>

      <PersonaSwitcher
        personas={personas}
        value={persona.id}
        onChange={id => { setPersonaId(id); setResult(null) }}
        onCreate={() => setCreating(true)}
        onDelete={id => { updateCustom(custom.filter(p => p.id !== id)); if (id === persona.id) setPersonaId(PERSONAS[0].id); setResult(null) }}
      />

      {creating && (
        <PersonaForm
          onCancel={() => setCreating(false)}
          onSave={p => {
            updateCustom([...custom.filter(c => c.id !== p.id), p])
            setPersonaId(p.id)
            setCreating(false)
            setResult(null)
          }}
        />
      )}

      <PresetButtons presets={PRESETS} disabled={loading} onPick={p => { setQuestion(p.question); ask(p.question) }} />

      <form
        onSubmit={e => {
          e.preventDefault()
          if (question.trim()) ask(question)
        }}
        className="flex gap-2"
      >
        <label htmlFor="q" className="sr-only">Your question</label>
        <input
          id="q"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          maxLength={300}
          placeholder="Ask anything…"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button disabled={loading || !question.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
          {loading ? 'Thinking…' : 'Ask'}
        </button>
      </form>

      {error && <p className="text-red-600">{error}</p>}

      {result && (
        <section className="space-y-6">
          <AnswerView answer={result.script.answer} />
          <VideoPanel videoKey={result.key} persona={result.persona} />
          <VideoScript script={result.script} />
        </section>
      )}
    </main>
  )
}
