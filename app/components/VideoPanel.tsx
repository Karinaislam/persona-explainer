'use client'
import { useEffect, useState } from 'react'
import type { JobStatus, Persona } from '@/lib/types'
import { ReviewPanel } from './ReviewPanel'

export function VideoPanel({ videoKey, persona }: { videoKey: string; persona: Persona }) {
  const [status, setStatus] = useState<JobStatus>({ state: 'pending', step: 'Checking cache' })
  const [attempt, setAttempt] = useState(0)
  const base = `/api/video/${videoKey}`

  useEffect(() => {
    let stop = false
    let timer: ReturnType<typeof setTimeout>
    let first = true
    const poll = async () => {
      const s: JobStatus = await fetch(base).then(r => r.json())
      if (stop) return
      // a previous failure is restarted when the panel opens or Retry is clicked
      const restart = s.state === 'none' || (first && s.state === 'error')
      first = false
      if (restart) {
        setStatus({ state: 'pending', step: 'Starting' })
        const r = await fetch('/api/video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: videoKey, persona }) })
        if (stop) return
        if (!r.ok) return setStatus({ state: 'error', step: '', error: (await r.json()).error })
      } else setStatus(s)
      if (restart || (s.state !== 'done' && s.state !== 'error')) timer = setTimeout(poll, 3000)
    }
    poll().catch(e => !stop && setStatus({ state: 'error', step: '', error: String(e) }))
    return () => {
      stop = true
      clearTimeout(timer)
    }
  }, [base, videoKey, persona, attempt])

  if (status.state === 'error')
    return (
      <div className="space-y-2">
        <p className="text-red-600">Video failed: {status.error}</p>
        <button onClick={() => setAttempt(a => a + 1)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
          Retry
        </button>
      </div>
    )
  if (status.state !== 'done')
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-900" aria-live="polite">
        <span className="animate-pulse">{status.step || 'Working'}… (this can take 1–3 minutes)</span>
      </div>
    )
  return (
    <div className="space-y-3">
      <video key={videoKey} src={`${base}/file`} controls autoPlay className="w-full rounded-xl" />
      <a href={`${base}/file?download=1`} className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
        Download MP4
      </a>
      <ReviewPanel videoKey={videoKey} persona={persona} />
    </div>
  )
}
