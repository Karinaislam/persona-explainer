import type { Preset } from '@/lib/presets'

export function PresetButtons({ presets, disabled, onPick }: { presets: Preset[]; disabled: boolean; onPick: (p: Preset) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map(p => (
        <button
          key={p.id}
          disabled={disabled}
          onClick={() => onPick(p)}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {p.question}
        </button>
      ))}
    </div>
  )
}
