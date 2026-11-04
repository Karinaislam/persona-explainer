import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildStitchArgs, buildStillClipArgs, runFfmpeg, probeDuration } from '@/lib/ffmpeg'

const trickyText = 'F = m·g: 9.8 m/s² 100%'
const font = path.join(process.cwd(), 'public/fonts/Inter-Bold.ttf')

describe('buildStitchArgs', () => {
  const args = buildStitchArgs({
    clips: ['a.mp4', 'b.mp4', 'c.mp4', 'd.mp4'],
    audio: 'voice.wav',
    captions: [0, 1, 2, 3].map(i => ({ textFile: `c${i}.txt`, start: i * 8, end: (i + 1) * 8 })),
    fontFile: font,
    clipSeconds: [8, 8, 8, 8],
    out: 'out.mp4',
  })
  const joined = args.join(' ')
  it('uses textfile and never inline text', () => {
    expect(joined).toContain('textfile=')
    expect(joined).not.toContain(trickyText)
  })
  it('pads audio and trims to video', () => {
    expect(args).toContain('-shortest')
    expect(joined).toContain('apad')
  })
  it('sets a half-open enable window per caption so neighbours never share a frame', () => {
    for (let i = 0; i < 4; i++) expect(joined).toContain(`gte(t,${i * 8})*lt(t,${(i + 1) * 8})`)
  })
  it('draws captions at the bottom of the frame', () => {
    const filter = args[args.indexOf('-filter_complex') + 1]
    expect(filter.split(',').find(f => f.includes('c0.txt'))).toContain('y=h-text_h')
  })
  it('freezes the last frame so the video can outlast the clips', () => {
    expect(joined).toContain('tpad=stop_mode=clone')
  })
})

describe('ffmpeg integration', () => {
  let dir: string
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-'))
  })

  it('makes a still clip of exact length', async () => {
    const png = path.join(dir, 'still.png')
    await runFfmpeg(['-f', 'lavfi', '-i', 'color=c=blue:s=640x360', '-frames:v', '1', png])
    const out = path.join(dir, 'still.mp4')
    await runFfmpeg(buildStillClipArgs(png, 2, out))
    expect(await probeDuration(out)).toBeCloseTo(2, 0)
  })

  it('stitches clips, long audio and tricky caption text to the video length', async () => {
    const colors = ['red', 'green', 'blue', 'yellow']
    const clips = await Promise.all(colors.map(async (c, i) => {
      const f = path.join(dir, `clip${i}.mp4`)
      // clips carry their own audio track, which must be dropped
      await runFfmpeg(['-f', 'lavfi', '-i', `color=c=${c}:s=1280x720:d=2:r=30`, '-f', 'lavfi', '-i', 'sine=d=2', '-shortest', '-pix_fmt', 'yuv420p', f])
      return f
    }))
    const audio = path.join(dir, 'voice.wav')
    await runFfmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:d=10', audio])
    const captions = [0, 1, 2, 3].map(i => {
      const textFile = path.join(dir, `o${i}.txt`)
      fs.writeFileSync(textFile, trickyText)
      return { textFile, start: i * 2, end: (i + 1) * 2 }
    })
    const out = path.join(dir, 'final.mp4')
    await runFfmpeg(buildStitchArgs({ clips, audio, captions, fontFile: font, clipSeconds: [2, 2, 2, 2], out }))
    expect(Math.abs((await probeDuration(out)) - 8)).toBeLessThanOrEqual(0.2)
  })

  it('extends the video to the requested length when narration outlasts the clips', async () => {
    const clip = path.join(dir, 'short.mp4')
    await runFfmpeg(['-f', 'lavfi', '-i', 'color=c=red:s=1280x720:d=2:r=30', '-pix_fmt', 'yuv420p', clip])
    const audio = path.join(dir, 'long.wav')
    await runFfmpeg(['-f', 'lavfi', '-i', 'sine=d=5', audio])
    const capFile = path.join(dir, 'cap.txt')
    fs.writeFileSync(capFile, 'The force is 9.8 m/s², 100% of the time')
    const out = path.join(dir, 'long.mp4')
    await runFfmpeg(buildStitchArgs({ clips: [clip], audio, captions: [{ textFile: capFile, start: 0, end: 5 }], fontFile: font, clipSeconds: [5], out }))
    expect(Math.abs((await probeDuration(out)) - 5)).toBeLessThanOrEqual(0.2)
  })

  it('cuts each clip to its own scene length', async () => {
    const clips = await Promise.all(['red', 'blue'].map(async c => {
      const f = path.join(dir, `long-${c}.mp4`)
      await runFfmpeg(['-f', 'lavfi', '-i', `color=c=${c}:s=1280x720:d=8:r=30`, '-pix_fmt', 'yuv420p', f])
      return f
    }))
    const audio = path.join(dir, 'five.wav')
    await runFfmpeg(['-f', 'lavfi', '-i', 'sine=d=5', audio])
    const out = path.join(dir, 'scenes.mp4')
    await runFfmpeg(buildStitchArgs({ clips, audio, captions: [], fontFile: font, clipSeconds: [2, 3], out }))
    expect(Math.abs((await probeDuration(out)) - 5)).toBeLessThanOrEqual(0.2)
    // frame at 2.5s must come from the second (blue) clip
    const png = path.join(dir, 'scene2.png')
    await runFfmpeg(['-ss', '2.5', '-i', out, '-frames:v', '1', '-vf', 'scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', png])
    const [r, , b] = fs.readFileSync(png)
    expect(b).toBeGreaterThan(r)
  })
})
