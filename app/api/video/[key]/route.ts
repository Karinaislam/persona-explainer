import fs from 'node:fs'
import { videoPath } from '@/lib/cache'
import { getJob } from '@/lib/jobs'
import { bad, isKey } from '@/lib/http'

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  if (!isKey(key)) return bad('Invalid key')
  if (fs.existsSync(videoPath(key))) return Response.json({ state: 'done', step: 'Done' })
  // a remembered 'done' without its file (e.g. cache cleared) means it must be rendered again
  const job = getJob(key)
  return Response.json(job && job.state !== 'done' ? job : { state: 'none', step: '' })
}
