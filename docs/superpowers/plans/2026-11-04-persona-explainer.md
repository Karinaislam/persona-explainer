# Persona Explainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local Next.js app where a seeded persona asks a question and gets a persona-tailored text answer plus a ~30s narrated MP4, which plays in-app and can be downloaded.

**Architecture:** The Llama API returns a JSON script: the answer, a style bible, and 4 shots. A render pipeline makes 4 × 8s clips. Draft mode uses still images with a slow zoom; Veo mode uses Veo. Gemini TTS makes one continuous voiceover, and ffmpeg stitches the clips, lays in the audio, and burns in overlays. Results are cached on disk per (persona, question). Preset buttons serve cached results instantly.

**Tech Stack:** Next.js (App Router) + TypeScript, `openai` SDK pointed at the Llama API's OpenAI-compatible endpoint, `@google/genai` (Veo, image, TTS), `ffmpeg-static`, `zod`, `vitest`.

**Spec:** `docs/superpowers/specs/2026-11-04-persona-explainer-design.md`

## Global Constraints

- Deadline 2026-11-11. Local laptop only, no deployment.
- Video ~30s = **4 shots × 8s**. Narration ~75 words total.
- **Veo budget $10 total; the app refuses Veo calls once spend + estimate exceeds $9.**
- Draft mode is the default everywhere. Veo mode is opt-in per render.
- Veo is used only for **gravity × 2 personas**.
- Veo prompts must ask for **no text in frame**. All text and equations come from ffmpeg overlays.
- The same (persona, question) is never regenerated if cached.
- Secrets live only in `.env.local` (gitignored): `LLAMA_API_KEY`, `GEMINI_API_KEY`.
- Model ids live in env (they change): `LLAMA_MODEL`, `VEO_MODEL`, `IMAGE_MODEL`, `TTS_MODEL`, plus `VEO_PRICE_PER_SEC`.

## Review Focus

1. **Llama returns invalid or wrong-shaped JSON** (code fences, 3 or 5 shots, missing narration). Strip fences, validate, and retry up to 3×. Then fail with a clear error, never with half a video. (Task 2 tests)
2. **Overlay text with quotes, colons, `%` or `=`** (e.g. `F = m·g`, `9.8 m/s²`) breaks ffmpeg drawtext escaping. Pass the text through `textfile=` files, never inline. (Task 5 test)
3. **Spend cap at the boundary.** A render whose estimate would cross $9 is refused *before* any Veo call. Spend is recorded per finished clip, so a crash mid-render doesn't lose the count. (Task 3 tests)
4. **The same question with different casing or spacing** must hit the same cache key, and the same question for a different persona must not. (Task 3 tests)
5. **Narration longer than 32s** must not make the video run longer than the clips. Pad short audio and trim to the video length. (Task 5 test)

---

## File Structure

```
lib/types.ts            Persona, Shot, Script, RenderMode, JobStatus
lib/personas.ts         seeded personas
lib/presets.ts          hero preset questions
lib/llama.ts            buildPrompt, parseScript, generateScript
lib/cache.ts            cacheKey, paths, read/write result
lib/spend.ts            cost estimate, cap check, spend ledger
lib/gemini.ts           generateClip (Veo), generateStill, synthesizeSpeech
lib/ffmpeg.ts           arg builders + runFfmpeg
lib/pipeline.ts         renderVideo(...)
lib/jobs.ts             in-memory job status map
app/api/ask/route.ts    POST -> text answer + script
app/api/video/route.ts  POST -> start render
app/api/video/[key]/route.ts       GET -> status
app/api/video/[key]/file/route.ts  GET -> MP4 (inline / ?download=1)
app/page.tsx + app/components/*    UI
public/fonts/Inter-Bold.ttf        overlay font
data/                   cache + spend.json (gitignored)
scripts/pregen.ts       pre-generate hero videos
```

---

### Task 1: Scaffold, types, personas, presets (Day 1)

**Files:**
- Create: the Next.js app (`npx create-next-app@latest . --ts --app --eslint --tailwind --no-src-dir --import-alias "@/*" --yes`), `lib/types.ts`, `lib/personas.ts`, `lib/presets.ts`, `.env.example`, `vitest.config.ts`
- Test: `tests/personas.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Persona = { id: string; name: string; age: number; interests: string[];
    level: string; tone: string; visualStyle: string; voice: string } // voice = Gemini prebuilt voice name
  type Shot = { veoPrompt: string; narration: string; overlay?: string }
  type Script = { answer: string; styleBible: string; shots: Shot[] } // exactly 4 shots
  type RenderMode = 'draft' | 'veo'
  type JobStatus = { state: 'pending' | 'done' | 'error'; step: string; error?: string }
  const PERSONAS: Persona[]; function getPersona(id: string): Persona // throws on unknown id
  type Preset = { id: string; question: string; veo: boolean }; const PRESETS: Preset[]
  ```

- [ ] **Step 1:** Run the scaffold command in `D:\persona-explainer` (keep `docs/`), then `git init`. Install `openai @google/genai ffmpeg-static zod` and dev deps `vitest tsx`. Add `"test": "vitest run"`. Add `data/` and `.env.local` to `.gitignore`. Download Inter Bold from Google Fonts into `public/fonts/Inter-Bold.ttf`.
- [ ] **Step 2:** Write `tests/personas.test.ts`: `getPersona('ayaan').age === 10`; `getPersona('sara').interests` is non-empty; `getPersona('nope')` throws; persona ids are unique; `PRESETS.filter(p => p.veo).map(p => p.id)` equals `['gravity']`.
- [ ] **Step 3:** Run `npm test`. Expected: FAIL (modules missing).
- [ ] **Step 4:** Implement the types and seeds:
  - **`ayaan`:** 10 years old, football, playful, bright cartoon style, voice `Puck`.
  - **`sara`:** first-year engineering student, machines and mechanics, precise, clean technical 3D style, voice `Kore`.
  - **Presets:** `gravity` ("How does gravity work?", veo: true), plus 2 draft-only presets: `rainbow` ("Why do rainbows form?") and `magnets` ("How do magnets work?").
  - **`.env.example`:** list every env var from Global Constraints. Set `VEO_PRICE_PER_SEC=0.15` as a placeholder and **verify it against current Gemini API Veo pricing**.
- [ ] **Step 5:** Run `npm test`. Expected: PASS.
- [ ] **Step 6:** Commit: `git add -A && git commit -m "feat: scaffold app, types, personas, presets"`.

### Task 2: Llama script generation (Day 1–2)

**Files:**
- Create: `lib/llama.ts`
- Test: `tests/llama.test.ts`

**Interfaces:**
- Consumes: `Persona`, `Script` from Task 1.
- Produces: `buildPrompt(persona: Persona, question: string): { system: string; user: string }`; `parseScript(raw: string): Script` (throws `ScriptError`); `generateScript(persona, question, complete?: (sys, user) => Promise<string>): Promise<Script>`. `complete` defaults to the Llama call and is injectable for tests.

- [ ] **Step 1:** Write the tests:
  - **`parseScript`**:
    - accepts valid JSON wrapped in ```json fences
    - throws on 3 shots or on 5 shots
    - throws on a missing `narration`
    - throws on non-JSON text
  - **`buildPrompt(getPersona('ayaan'), q).system`** contains `football`, `4`, and `no text`.
  - **`generateScript`**:
    - with a fake `complete` that returns junk twice and then valid JSON, it resolves, and `complete` was called 3 times
    - with a fake that always returns junk, it rejects after exactly 3 calls
- [ ] **Step 2:** Run `npm test tests/llama.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement using a zod schema (`shots: z.array(...).length(4)`). The Llama client is `new OpenAI({ apiKey: LLAMA_API_KEY, baseURL: 'https://api.llama.com/compat/v1/' })` with `response_format: { type: 'json_object' }` (drop the option if the API rejects it). The system prompt includes the persona fields and these rules:
  - ~75 words of narration total, split across the shots
  - each `veoPrompt` repeats the `styleBible`
  - no text, letters or numbers in frame
  - put equations and labels in `overlay`
  - analogies drawn from the persona's interests
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Smoke-test by hand: `npx tsx -e` calling `generateScript(getPersona('sara'), 'How does gravity work?')` with the real key. Check that the output is engineering-flavored and that the ayaan version uses football.
- [ ] **Step 6:** Commit `feat: llama script generation with validation and retry`.

### Task 3: Cache and spend ledger (Day 2)

**Files:**
- Create: `lib/cache.ts`, `lib/spend.ts`
- Test: `tests/cache.test.ts`, `tests/spend.test.ts`

**Interfaces:**
- Produces:
  - **`cache.ts`:**
    - `cacheKey(personaId: string, question: string): string`: sha1 of `personaId + '|' + normalized question` (lowercase, trimmed, whitespace collapsed), first 12 hex chars
    - `cacheDir(key): string`, which is `data/cache/<key>`
    - `videoPath(key, mode: RenderMode): string`, which is `<dir>/final-<mode>.mp4`
    - `readScript(key): Script | null`
    - `writeScript(key, script): void`
  - **`spend.ts`:**
    - `estimateVeoCost(shots: number, clipSec: number, pricePerSec: number): number`
    - `checkCap(estimate: number, ledgerPath?: string): void`, which throws `SpendCapError` if `spent + estimate > 9`
    - `recordSpend(amount: number, note: string, ledgerPath?: string): void`
    - `getSpent(ledgerPath?: string): number`
    - The ledger is `data/spend.json` (`{ total, entries[] }`). Tests pass a temp path.

- [ ] **Step 1:** Write the tests:
  - **Cache keys:**
    - `cacheKey('sara','How does  Gravity work? ')` equals `cacheKey('sara','how does gravity work?')`
    - `cacheKey('ayaan', q)` differs from `cacheKey('sara', q)`
    - the key matches `/^[0-9a-f]{12}$/`
    - a written script reads back equal, and a missing key returns `null`
  - **Spend:**
    - `estimateVeoCost(4, 8, 0.15)` is `4.8` (use `toBeCloseTo`)
    - with spent 4.8, `checkCap(4.2)` passes and `checkCap(4.21)` throws
    - two `recordSpend(1.2)` calls make `getSpent()` return `2.4`
    - a missing ledger file means spent is `0`
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement with `node:crypto` and `node:fs`. Create directories on write.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: disk cache and veo spend cap`.

### Task 4: Gemini clients (Day 2–3)

**Files:**
- Create: `lib/gemini.ts`
- Test: manual smoke (live, paid APIs). Draft-mode calls only, plus **exactly one** Veo clip.

**Interfaces:**
- Produces:
  - `generateStill(prompt: string, outPng: string): Promise<void>` (`IMAGE_MODEL`, 16:9)
  - `generateClip(prompt: string, outMp4: string): Promise<void>`: Veo via `ai.models.generateVideos({ model: VEO_MODEL, prompt, config: { aspectRatio: '16:9' } })`. Poll `ai.operations.getVideosOperation` every 10s with a 6-minute timeout, then `ai.files.download`. If the API supports it, disable native audio.
  - `synthesizeSpeech(text: string, voice: string, outWav: string): Promise<void>`: `generateContent` with `responseModalities: ['AUDIO']` and `prebuiltVoiceConfig.voiceName = voice`. The response is base64 PCM s16le 24kHz mono; write it via ffmpeg (`-f s16le -ar 24000 -ac 1`) or a WAV header.

- [ ] **Step 1:** Implement the three functions. Check the installed `@google/genai` typings (`node_modules/@google/genai/dist/*.d.ts`) for exact parameter names before writing.
- [ ] **Step 2:** Smoke-test the still and TTS: run `npx tsx scripts/smoke-gemini.ts still` and `... tts`. Expected: `data/smoke/still.png` opens and `data/smoke/voice.wav` plays.
- [ ] **Step 3:** Smoke-test Veo, with exactly one 8s clip: `npx tsx scripts/smoke-gemini.ts veo`. **Call `checkCap` before and `recordSpend` after.** Expected: an 8s MP4. Note the actual cost in AI Studio billing and update `VEO_PRICE_PER_SEC` if it differs. **If 2 × 4 clips no longer fit under the remaining cap, stop and tell the user** before continuing.
- [ ] **Step 4:** Commit `feat: gemini veo, image and tts clients`.

### Task 5: ffmpeg assembly (Day 3)

**Files:**
- Create: `lib/ffmpeg.ts`
- Test: `tests/ffmpeg.test.ts`

**Interfaces:**
- Produces:
  - `buildStillClipArgs(imagePng: string, seconds: number, outMp4: string): string[]`: a slow zoom (`zoompan`) to 1280x720, 30fps, exactly `seconds` long
  - `buildStitchArgs(opts: { clips: string[]; audio: string; overlays: { textFile: string; start: number; end: number }[]; fontFile: string; out: string }): string[]`: concat the clips scaled to 1280x720, then a `drawtext=textfile=...:enable='between(t,start,end)'` per overlay, then `apad` on the audio, `-shortest`, `-c:v libx264 -pix_fmt yuv420p -c:a aac`
  - `runFfmpeg(args: string[]): Promise<void>`: spawns `ffmpeg-static` and rejects with stderr on a non-zero exit

- [ ] **Step 1:** Write the tests:
  - **Arg builders:**
    - the `buildStitchArgs` output contains `textfile=` and never contains the raw overlay text
    - it includes `-shortest` and `apad`
    - the `enable` windows are `between(t,0,8)` … `between(t,24,32)` for 4 overlays
  - **Integration test:** generate 4 two-second color clips with `-f lavfi -i color=...` and a 10-second `sine` audio, then stitch them with an overlay file containing `F = m·g: 9.8 m/s² 100%`. The output exists, and its duration (via `ffmpeg -i` stderr parse) is 8s ± 0.2.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Font path: `public/fonts/Inter-Bold.ttf`. On Windows, escape the `:` in drive-letter paths inside filter strings (`D\:/...`), or use relative paths with ffmpeg's `cwd` set to the project root.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: ffmpeg clip and stitch builders`.

### Task 6: Render pipeline and API (Day 4)

**Files:**
- Create: `lib/pipeline.ts`, `lib/jobs.ts`, `app/api/ask/route.ts`, `app/api/video/route.ts`, `app/api/video/[key]/route.ts`, `app/api/video/[key]/file/route.ts`
- Test: `tests/pipeline.test.ts`

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces:
  - `renderVideo(key: string, persona: Persona, script: Script, mode: RenderMode, deps?: Partial<{ generateClip; generateStill; synthesizeSpeech; runFfmpeg }>, onStep?: (s: string) => void): Promise<string>`:
    - returns the final MP4 path
    - returns early if `videoPath(key, mode)` already exists
    - in Veo mode, calls `checkCap(estimateVeoCost(4, 8, price))` before any clip, then `recordSpend` after each clip
    - generates the 4 shots in parallel
  - `jobs.ts`: `getJob(key, mode): JobStatus | undefined`, `startJob(key, mode, fn: (onStep) => Promise<string>): void`
  - **HTTP:**
    - `POST /api/ask {personaId, question}` returns `{ key, answer, cached: boolean }` (generates and caches the script if needed)
    - `POST /api/video {key, personaId, mode}` returns `{ state }`
    - `GET /api/video/[key]?mode=` returns `JobStatus` (`done` if the file exists on disk)
    - `GET /api/video/[key]/file?mode=&download=1` streams the MP4 (`Content-Disposition: attachment` when `download=1`)

- [ ] **Step 1:** Write the tests, with all deps faked to write empty files:
  - **Draft mode:** calls `generateStill` 4× and `generateClip` 0×
  - **Veo mode:**
    - with the ledger at 8.5, it rejects with `SpendCapError` and `generateClip` is never called
    - with a fresh ledger, `generateClip` is called 4× and spend is recorded 4×
  - **Cache:** a second call with the final file present calls no deps
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Write each overlay to `<dir>/overlay-<i>.txt`. The narration is all 4 shots' `narration` joined with spaces. Set `export const runtime = 'nodejs'` on every route.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Manual test: start `npm run dev` and `curl` the ask and video endpoints for `sara` + gravity in draft mode. Expected: the status becomes `done` and the file plays.
- [ ] **Step 6:** Commit `feat: render pipeline and api routes`.

### Task 7: UI (Day 5)

**Files:**
- Create: `app/page.tsx`, `app/components/PersonaSwitcher.tsx`, `app/components/PresetButtons.tsx`, `app/components/VideoPanel.tsx`

**Interfaces:**
- Consumes: the HTTP API from Task 6, `PERSONAS`, `PRESETS`.

- [ ] **Step 1:** Build the page:
  - **Persona switcher:** cards showing name, age and interests.
  - **Preset buttons and a free-text input.**
  - **Answer:** the text answer shows as soon as `/api/ask` returns.
  - **Video panel:**
    - starts a render: `mode = 'veo'` only when the preset has `veo: true`, otherwise `'draft'`
    - polls status every 3s and shows the current step
    - shows a `<video controls>` and a **Download MP4** link (`?download=1`)
    - a cached `done` result shows instantly
- [ ] **Step 2:** Manual test in the browser: switch personas on the `rainbow` preset and check that the two answers and draft videos are clearly different, and that the download saves an MP4.
- [ ] **Step 3:** Commit `feat: persona explainer ui`.

### Task 8: Pre-generate hero videos and rehearse (Day 6–7)

**Files:**
- Create: `scripts/pregen.ts`

- [ ] **Step 1:** Write `scripts/pregen.ts [--veo]`: for every persona × preset, run ask + `renderVideo`. Use Veo only for presets with `veo: true` and only with `--veo`; everything else runs in draft mode. Print `getSpent()` at the end.
- [ ] **Step 2:** Run `npx tsx scripts/pregen.ts` (draft only). Tune the prompts in `lib/llama.ts` until both personas look and sound distinct. **Delete a cached draft to re-render it, never a Veo one.**
- [ ] **Step 3:** When the prompts are final, run `npx tsx scripts/pregen.ts --veo` once. Expected: two Veo gravity videos, with spend ≤ $9.
- [ ] **Step 4:** Rehearse: restart the server and click every preset for both personas. Every one should load instantly from the cache. Back up `data/cache` to a second location.
- [ ] **Step 5:** Commit `chore: pregen script` (do not commit `data/`).
