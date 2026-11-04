import type { JobStatus } from './types'

// shortcut: in-memory, lost on server restart (finished videos are on disk, so only in-flight progress is lost)
const g = globalThis as unknown as { __jobs?: Map<string, JobStatus> }
const jobs = (g.__jobs ??= new Map())

export const getJob = (key: string) => jobs.get(key)

export function startJob(key: string, fn: (onStep: (s: string) => void) => Promise<string>): void {
  if (jobs.get(key)?.state === 'pending') return
  const status: JobStatus = { state: 'pending', step: 'Starting' }
  jobs.set(key, status)
  fn(s => (status.step = s))
    .then(() => Object.assign(status, { state: 'done', step: 'Done' }))
    .catch((e: unknown) => Object.assign(status, { state: 'error', error: e instanceof Error ? e.message : String(e) }))
}
