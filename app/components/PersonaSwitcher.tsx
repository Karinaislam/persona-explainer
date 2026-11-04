import type { Persona } from '@/lib/types'

export function PersonaSwitcher({
  personas,
  value,
  onChange,
  onCreate,
  onDelete,
}: {
  personas: Persona[]
  value: string
  onChange: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Persona">
      {personas.map(p => (
        <div key={p.id} className="relative">
          <button
            role="radio"
            aria-checked={value === p.id}
            onClick={() => onChange(p.id)}
            className={`h-full w-full rounded-xl border p-4 text-left transition ${value === p.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800'}`}
          >
            <div className="pr-6 font-semibold">
              {p.name}, {p.age}
            </div>
            <div className="text-sm text-zinc-500">{p.level}</div>
            <div className="mt-1 text-sm">Loves {p.interests.join(', ')}</div>
          </button>
          {p.id.startsWith('custom-') && (
            <button
              onClick={() => onDelete(p.id)}
              aria-label={`Delete persona ${p.name}`}
              className="absolute right-2 top-2 rounded px-2 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onCreate}
        className="rounded-xl border border-dashed border-zinc-300 p-4 text-left text-zinc-500 hover:border-indigo-500 hover:text-indigo-600 dark:border-zinc-700"
      >
        <div className="font-semibold">+ Create persona</div>
        <div className="text-sm">Describe any learner, or let AI fill it in</div>
      </button>
    </div>
  )
}
