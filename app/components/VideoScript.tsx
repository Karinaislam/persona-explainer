import type { Script } from '@/lib/types'

export function VideoScript({ script }: { script: Script }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Video script</h2>
      <p className="text-sm text-zinc-500">
        <span className="font-medium">Style:</span> {script.styleBible}
      </p>
      <ol className="space-y-3">
        {script.shots.map((s, i) => (
          <li key={i} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Scene {i + 1}</span>
              {s.overlay && <span className="rounded bg-indigo-600 px-2 py-0.5 text-sm text-white">{s.overlay}</span>}
            </div>
            <p className="leading-relaxed">
              <span className="font-medium">Narrator:</span> “{s.narration}”
            </p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">
              <span className="font-medium">Visual:</span> {s.visualPrompt}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
