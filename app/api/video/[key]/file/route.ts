import fs from 'node:fs'
import { Readable } from 'node:stream'
import type { NextRequest } from 'next/server'
import { videoPath } from '@/lib/cache'
import { bad, isKey } from '@/lib/http'

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  if (!isKey(key)) return bad('Invalid key')
  const file = videoPath(key)
  if (!fs.existsSync(file)) return bad('Not ready', 404)

  const size = fs.statSync(file).size
  const headers: Record<string, string> = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' }
  if (req.nextUrl.searchParams.get('download')) headers['Content-Disposition'] = `attachment; filename="explainer-${key}.mp4"`

  // Range support so the <video> player can seek
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') ?? '')
  const start = m?.[1] ? Number(m[1]) : 0
  const end = m?.[2] ? Math.min(Number(m[2]), size - 1) : size - 1
  if (m && (start > end || start >= size)) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  const body = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream
  headers['Content-Length'] = String(end - start + 1)
  if (m) headers['Content-Range'] = `bytes ${start}-${end}/${size}`
  return new Response(body, { status: m ? 206 : 200, headers })
}
