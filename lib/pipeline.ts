import fs from 'node:fs'
import path from 'node:path'
import * as meta from './meta'
import { buildStillClipArgs, buildStitchArgs, runFfmpeg } from './ffmpeg'
import { cacheDir, videoPath } from './cache'
import { captionChunks } from './captions'
import type { Persona, Script } from './types'

export const CLIP_SEC = 8

type Deps = {
  generateStill: typeof meta.generateStill
  synthesizeSpeech: typeof meta.synthesizeSpeech
  runFfmpeg: typeof runFfmpeg
}

const round2 = (n: number) => Math.round(n * 100) / 100

// Muse Image draws each scene, Meta MMS-TTS voices it, ffmpeg animates and stitches with timed captions
export async function renderVideo(
  key: string,
  _persona: Persona,
  script: Script,
  deps: Partial<Deps> = {},
  onStep: (s: string) => void = () => {},
): Promise<string> {
  const final = videoPath(key)
  if (fs.existsSync(final)) return final

  const d: Deps = { generateStill: meta.generateStill, synthesizeSpeech: meta.synthesizeSpeech, runFfmpeg, ...deps }
  const dir = path.join(cacheDir(key), 'scenes')
  fs.mkdirSync(dir, { recursive: true })
  const clips = script.shots.map((_, i) => path.join(dir, `clip-${i}.mp4`))
  const voice = path.join(dir, 'voice.wav')
  const timingFile = path.join(dir, 'voice.json')

  onStep('Drawing scenes with Muse Image and recording the narration')
  // allSettled: a failed scene must not leave the others running after we return
  const results = await Promise.allSettled([
    // an existing voiceover is reused only together with its timing
    fs.existsSync(voice) && fs.existsSync(timingFile)
      ? Promise.resolve()
      : d.synthesizeSpeech(script.shots.map(s => s.narration), voice + '.tmp').then(timing => {
          fs.renameSync(voice + '.tmp', voice)
          fs.writeFileSync(timingFile, JSON.stringify(timing))
        }),
    ...script.shots.map(async (s, i) => {
      if (fs.existsSync(clips[i])) return
      const img = path.join(dir, `still-${i}.webp`)
      // Muse Image renders text well, so it draws the title; our captions need the bottom strip
      const title = s.overlay ? `\nInfographic title at the top: "${s.overlay}".` : ''
      await d.generateStill(`${s.visualPrompt}${title}\nKeep the bottom fifth of the image empty background, with no text or details (subtitles go there).`, img)
      const tmp = clips[i].replace(/\.mp4$/, '.tmp.mp4')
      await d.runFfmpeg(buildStillClipArgs(img, CLIP_SEC, tmp))
      fs.renameSync(tmp, clips[i])
    }),
  ])
  const failed = results.find(r => r.status === 'rejected')
  if (failed) throw (failed as PromiseRejectedResult).reason

  onStep('Stitching video')
  // each scene lasts exactly as long as its own narration; the video ends just after the voice
  const { starts, total }: meta.VoiceTiming = JSON.parse(fs.readFileSync(timingFile, 'utf8'))
  const ends = [...starts.slice(1), total + 0.5]
  const clipSeconds = starts.map((s, i) => round2(ends[i] - s))
  let n = 0
  const captions = script.shots.flatMap((s, i) =>
    captionChunks(s.narration, ends[i] - starts[i]).map(c => {
      const textFile = path.join(dir, `caption-${n++}.txt`)
      fs.writeFileSync(textFile, c.text)
      return { textFile, start: round2(starts[i] + c.start), end: round2(starts[i] + c.end) }
    }),
  )
  const fontFile = path.join(process.cwd(), 'public', 'fonts', 'Inter-Bold.ttf')
  // write to a temp name so a half-written file never counts as cached
  const tmp = final.replace(/\.mp4$/, '.tmp.mp4')
  await d.runFfmpeg(buildStitchArgs({ clips, audio: voice, captions, fontFile, clipSeconds, out: tmp }))
  fs.renameSync(tmp, final)
  return final
}
