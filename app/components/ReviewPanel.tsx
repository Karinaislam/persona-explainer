'use client'
import { useEffect, useState } from 'react'
import type { Review } from '@/lib/review'
import type { Persona } from '@/lib/types'

const tone = (score: number) => (score >= 8 ? 'text-green-600 dark:text-green-400' : score >= 6 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600')

export function ReviewPanel({ videoKey, persona }: { videoKey: string; persona: Persona }) {
  const [review, setReview] = useState<Review | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stop = false
    fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: videoKey, persona }) })
      .then(async r => {
        const data = await r.json()
        if (stop) return
        if (!r.ok) setError(data.error)
        else setReview(data)
      })
      .catch(e => !stop && setError(String(e)))
    return () => {
      stop = true
    }
  }, [videoKey, persona])

  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800" aria-live="polite">
      <h2 className="font-semibold">AI quality check</h2>
      {error && <p className="text-sm text-red-600">Review failed: {error}</p>}
      {!review && !error && <p className="animate-pulse text-sm text-zinc-500">Muse Wonder is watching the video and Muse Voice Transcribe is listening to the narration…</p>}
      {review && (
        <>
          <div className="flex flex-wrap gap-6">
            <p>
              <span className={`text-2xl font-bold ${tone(review.wonder.score)}`}>{review.wonder.score}/10</span>
              <span className="ml-2 text-sm text-zinc-500">video matches the script (Muse Wonder)</span>
            </p>
            <p>
              <span className={`text-2xl font-bold ${tone(review.voiceAccuracy * 10)}`}>{Math.round(review.voiceAccuracy * 100)}%</span>
              <span className="ml-2 text-sm text-zinc-500">narration spoken correctly (Muse Voice Transcribe)</span>
            </p>
          </div>
          <p className="text-sm leading-relaxed">{review.wonder.summary}</p>
          <ul className="space-y-1 text-sm">
            {review.wonder.scenes.map(s => (
              <li key={s.scene}>
                <span className={`font-semibold ${tone(s.score)}`}>Scene {s.scene}: {s.score}/10</span>
                {s.issue && <span className="text-zinc-600 dark:text-zinc-400"> · {s.issue}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
