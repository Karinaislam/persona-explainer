import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'

const FPS = 30

// Paths inside a filtergraph: forward slashes, escaped drive colon, single-quoted
const filterPath = (p: string) => `'${p.replace(/\\/g, '/').replace(/:/g, '\\:')}'`

export function buildStillClipArgs(imagePng: string, seconds: number, outMp4: string): string[] {
  const frames = seconds * FPS
  const zoom = `scale=2560:-2,zoompan=z='min(zoom+0.0003,1.08)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720:fps=${FPS}`
  return ['-i', imagePng, '-vf', zoom, '-frames:v', String(frames), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outMp4]
}

type TimedText = { textFile: string; start: number; end: number }

// half-open window so back-to-back texts never share a frame
const drawText = (fontFile: string, t: TimedText, style: string) =>
  `drawtext=fontfile=${filterPath(fontFile)}:textfile=${filterPath(t.textFile)}:expansion=none:${style}:enable='gte(t,${t.start})*lt(t,${t.end})'`

const CAPTION_STYLE = 'fontsize=40:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=14:x=(w-text_w)/2:y=h-text_h-50'

export function buildStitchArgs(opts: {
  clips: string[]
  audio: string
  captions: TimedText[] // narration subtitles, bottom of frame
  fontFile: string
  clipSeconds: number[] // length of each scene; a clip is cut short or its last frame held to fit
  out: string
}): string[] {
  const { clips, audio, captions, fontFile, clipSeconds, out } = opts
  const seconds = clipSeconds.reduce((a, b) => a + b, 0)
  const inputs = [...clips, audio].flatMap(f => ['-i', f])
  const norm = clips.map(
    (_, i) => `[${i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS},tpad=stop_mode=clone:stop_duration=${clipSeconds[i]},trim=duration=${clipSeconds[i]},setpts=PTS-STARTPTS[v${i}]`,
  )
  const concat = `${clips.map((_, i) => `[v${i}]`).join('')}concat=n=${clips.length}:v=1:a=0[vc]`
  // expansion=none so % in text isn't treated as a drawtext expression
  const text = captions.map(c => drawText(fontFile, c, CAPTION_STYLE))
  const video = text.length ? `[vc]${text.join(',')}[vout]` : '[vc]null[vout]'
  // bounded apad: an endless apad + -shortest never ends inside filter_complex
  const aud = `[${clips.length}:a]apad=whole_dur=${seconds}[aout]`
  return [
    ...inputs,
    '-filter_complex', [...norm, concat, video, aud].join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-shortest', '-t', String(seconds), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart',
    out,
  ]
}

function spawnFfmpeg(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath as unknown as string, ['-hide_banner', ...args])
    let stderr = ''
    p.stderr.on('data', d => (stderr += d))
    p.on('error', reject)
    p.on('close', code => resolve({ code: code ?? 1, stderr }))
  })
}

export async function runFfmpeg(args: string[]): Promise<void> {
  const { code, stderr } = await spawnFfmpeg(['-y', '-loglevel', 'error', ...args])
  if (code !== 0) throw new Error(`ffmpeg failed (${code}): ${stderr.slice(-2000)}`)
}

export async function probeDuration(file: string): Promise<number> {
  const { stderr } = await spawnFfmpeg(['-i', file])
  const m = stderr.match(/Duration: (\d+):(\d+):([\d.]+)/)
  if (!m) throw new Error(`Could not read duration of ${file}`)
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}
