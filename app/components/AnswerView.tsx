import type { Answer } from '@/lib/types'

const paragraphs = (text: string) => text.split(/\n\s*\n/).filter(p => p.trim())

const Label = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">{children}</h3>
)

export function AnswerView({ answer }: { answer: Answer }) {
  return (
    <article className="space-y-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <p className="text-lg font-medium leading-relaxed">{answer.summary}</p>

      {answer.sections.map((s, i) => (
        <section key={i} className="space-y-2">
          <h2 className="text-lg font-semibold">{s.heading}</h2>
          {paragraphs(s.body).map((p, j) => (
            <p key={j} className="leading-relaxed text-zinc-700 dark:text-zinc-300">
              {p}
            </p>
          ))}
        </section>
      ))}

      <section className="rounded-lg border-l-4 border-indigo-500 bg-zinc-50 p-4 dark:bg-zinc-900">
        <Label>Worked example</Label>
        {paragraphs(answer.example).map((p, j) => (
          <p key={j} className="leading-relaxed">
            {p}
          </p>
        ))}
      </section>

      <section>
        <Label>Recap</Label>
        <ul className="list-disc space-y-1 pl-5 leading-relaxed">
          {answer.keyPoints.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </section>

      <p className="rounded-lg bg-indigo-50 px-4 py-3 font-medium text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">💡 {answer.takeaway}</p>
    </article>
  )
}
