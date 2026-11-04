# Persona Explainer

**One question, explained for who you are, as a lesson, a narrated explainer video and a self-checked script. Built entirely on Meta models.**

Ask "How does gravity work?" as **Ayaan, 10, who loves football**, and you get a playful lesson with no formulas and a cartoon video where the football shows gravity. Ask the same question as **Sara, a first-year engineering student**, and you get Newton's law with units, a hoist-sizing calculation and a technical infographic video. Then Meta's own models watch and listen to each video and score it before you trust it.

> Meta Global AI Developer Hackathon · Startup track · Theme: *Build for Your World*

## Why

A single textbook explanation is too dense for a kid and too shallow for an engineer. Teachers adapt to the learner: their level, their interests, the examples that click for them. Persona Explainer does that automatically and also makes the 30-second video a learner would actually watch.

## What it does

1. **Pick or create a learner and ask anything.** Five built-in learners range from a 10-year-old football fan to a 68-year-old retired nurse. **Create your own** by describing them in one line ("a 68-year-old retired farmer who loves tractors") and Muse Spark fills in their interests, level, tone and the video style they'd enjoy; edit anything before saving. Custom personas are saved in the browser.
2. **Lesson:** a summary, 3-5 explanatory sections, a worked example built on the learner's interests, a recap and a takeaway. Accuracy rules steer away from common misconceptions and keep the math at the learner's level.
3. **Explainer video (~30s):** four infographic scenes with drawn-in titles, a narrated voiceover, and captions timed to the real voice. Plays in the page and downloads as MP4.
4. **Video script:** every scene's narration, visual and title, shown under the video.
5. **AI quality check:** Muse Wonder watches the finished video and scores each scene against the script, flagging problems (it once caught gravity arrows pointing *up*). Muse Voice Transcribe listens to the narration and reports how much was spoken correctly.

## Meta models used

| Model | Via | Role |
|---|---|---|
| **Muse Spark** | Meta Model API | Writes the persona-tailored lesson and the 4-scene video script (structured JSON, validated and retried), and builds new learner personas from a one-line description |
| **Muse Image** | Meta Model API | Draws each scene as an infographic, including its title text |
| **MMS-TTS** (`facebook/mms-tts-eng`, ONNX build `Xenova/mms-tts-eng`) | Meta open weights, run locally with transformers.js | Voices the narration, scene by scene, returning exact timings |
| **Muse Wonder** | Meta Model API | Watches the finished video and reviews it against the script |
| **Muse Voice Transcribe** | Meta Model API | Transcribes the narration to score its accuracy |

No other AI provider is used. ffmpeg only animates, captions and stitches.

## How it works

```
question + persona
      │
      ▼
Muse Spark ──► lesson + script (4 scenes: narration, visual prompt, title)
      │
      ├──► Muse Image ×4 ──► infographic stills ──► ffmpeg slow zoom ──┐
      │                                                               ├──► ffmpeg stitch + timed captions ──► MP4
      └──► MMS-TTS, scene by scene ──► voice.wav + exact scene starts ─┘
                                                                        │
                                Muse Wonder (watches) + Muse Voice Transcribe (listens) ──► quality report
```

Engineering details:
- **Timing follows the voice.** The narration is voiced scene by scene, so each scene's real start time is known. Scene lengths and captions come from those times, and the video ends with the voice.
- **TTS-safe narration.** The script spells numbers, units and symbols out in words, so the voice never garbles "9.8 m/s²".
- **Caching everywhere.** Lessons, scenes, voiceovers, videos and reviews are cached per (persona, question). Partial results are reused after a failure, and files are written via temp names so a half-written file never counts as done.
- **Safe ffmpeg text.** All on-screen text goes through `textfile=` with `expansion=none`, so quotes, colons and `%` can't break the filter.
- **Validated model output.** Muse Spark and Muse Wonder replies are parsed with zod and retried when malformed.
- **Untrusted personas are bounded.** Custom personas come from the browser, so the server validates and length-limits every field before it reaches a prompt; built-in personas always come from the server's own list. A custom persona's id is derived from its content, so editing it never reuses another learner's cache.

## Run it

Requirements: Node.js 22+ and a Meta Model API key from [dev.meta.ai](https://dev.meta.ai). ffmpeg is bundled through `ffmpeg-static`. The MMS-TTS weights download automatically on first use.

```bash
npm install
cp .env.example .env.local   # add LLM_API_KEY
npm run dev                  # http://localhost:3000
```

Optional:

```bash
npx tsx --env-file=.env.local scripts/pregen.ts   # pre-generate every preset for every persona
npx tsx --env-file=.env.local scripts/smoke.ts still   # one Muse Image call
npx tsx --env-file=.env.local scripts/smoke.ts tts     # one MMS-TTS call
npm test                                               # unit + ffmpeg integration tests
```

## Project layout

```
app/page.tsx                  UI: persona switcher, presets, lesson, video, review, script
app/api/ask                   POST: lesson + script (Muse Spark), cached
app/api/video                 POST: start a render; GET [key]: status; GET [key]/file: MP4 (supports seeking)
app/api/review                POST: Muse Wonder + Muse Voice Transcribe review, cached
app/api/persona               POST: one-line description → full persona (Muse Spark)
lib/llama.ts                  prompt, schema, retries for Muse Spark (any OpenAI-compatible endpoint)
lib/meta.ts                   Muse Image + MMS-TTS
lib/pipeline.ts               scenes → voice → timed captions → stitched MP4
lib/review.ts                 the quality check and word-accuracy scoring
lib/ffmpeg.ts, captions.ts    animation, stitching, caption splitting
lib/personas.ts, presets.ts   seeded learners and demo questions
```

## Limits

- Custom personas are stored in the browser, not in an account; the app does not learn a persona from how someone chats yet.
- MMS-TTS has one English voice, so both personas share it.
- The quality check reports problems but does not yet regenerate a flagged scene automatically.
- A new question takes about 2 minutes end to end (lesson ~25s, video ~40s, review ~45s); cached questions load instantly.
