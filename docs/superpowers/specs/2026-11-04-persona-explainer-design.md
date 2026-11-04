# Persona Explainer: Design

Hackathon project. Solo builder working with Claude. Deadline: 1 week (by 2026-11-11).

## Intent

A user asks a question ("How does gravity work?") and gets two things back, both tailored to *who they are*:

1. A **text answer**.
2. A **30-second narrated video** explaining the same idea, like NotebookLM's video overviews but personalized.

The point of the demo: **the same question gives clearly different answers and videos for different personas.**

## Personas

- Seeded/hardcoded for the demo. No sign-up, no learning from chat.
- Each persona has: name, age, interests, knowledge level, preferred tone, and a voice choice.
- Seed set (builder may add 1 more):
  - **Ayaan, 10**: loves football. Gets playful, simple explanations with football analogies (e.g. a cartoon football falling and arcing).
  - **Sara, first-year engineering student**: gets a mechanical explanation with forces, units, and equations (e.g. F = mg, a mass dropping in a rig).
- The persona shapes: **analogies** (from interests), **depth and tone**, **visual style** of the video, and **narrator voice**.

## User flow

1. User picks a persona from a switcher (visible in the UI so judges can flip between them).
2. User types a question.
3. **Text answer appears first** (within a few seconds).
4. A video panel shows progress while the video generates (1–3 minutes is acceptable).
5. When ready, the video plays in-app and has a **Download MP4** button.

## How it works (decided)

| Part | Choice |
|---|---|
| App | Next.js + TypeScript, runs locally on the laptop for the demo |
| Text + scene script | **Meta Llama API** (user has key) |
| Video clips | **Veo** via the **Gemini API** (AI Studio key, billing enabled) |
| Voiceover | **Gemini TTS** (same Gemini key) |
| Stitching | **ffmpeg** on the local server |

Pipeline:

1. **Llama** gets the question + persona and returns structured JSON:
   - the text answer
   - a narration script (~75 words, fits 30s)
   - **4 shots**, each ~8s: a Veo prompt (visual, persona-styled, *no text in frame*), the narration segment, and optional on-screen text/equation overlay.
   - Output is validated against a schema; on failure, retry (Llama is less reliable at strict JSON than Claude).
2. **Veo** generates the 4 clips **in parallel**.
3. **Gemini TTS** generates **one continuous voiceover** for the whole narration (not Veo's native audio, so the voice doesn't break at clip cuts).
4. **ffmpeg** stitches the 4 clips, lays the voiceover over them, and burns in text/equation overlays. Output: one ~30s MP4.
5. The same MP4 is served for in-app playback and download.

## Budget: $10 total for Veo

$10 covers development *and* the demo. Veo is billed per second, so at a rough estimate (check current pricing before the first call) that's only about **2 full 30s videos on the fast model**. That drives these rules:

- **Two render modes**, same pipeline and script:
  - **Draft mode (default during development):** instead of Veo clips, generate one cheap still image per shot (Gemini image model) and animate it with a slow pan/zoom in ffmpeg. Use this for all prompt and pipeline tuning.
  - **Veo mode:** real Veo clips. Used only for the final hero renders.
- **Veo budget goes to 1 hero topic: gravity × 2 personas** (the kid and the engineer). Other hero topics run in draft mode. *(Builder's call; the user can add budget for more.)*
- Use the **fast Veo variant** with Veo's native audio off, if the API allows it, to cut cost.
- Before any Veo call, show the estimated cost and keep a running spend total in a local file. Refuse Veo calls past a $9 cap.
- Never regenerate a cached (persona, question) result.

## Demo mode

- The demo uses **preset question buttons** for the hero questions. Each button maps to an exact cache key (persona + question id).
- A preset with a cached result loads it **instantly**. There's no live call, so no fallback swap is needed.
- The free-text box stays for showing that it works on any question (draft mode), but the pitch doesn't rely on it.

## Goals

- Same question + different persona = visibly and audibly different video and text.
- Works end-to-end for any question, with 2–3 **hero topics** (gravity first) tuned to look great.
- Reliable live demo.

## Non-goals

- Accounts, auth, real persona inference, persona editing UI.
- Cloud deployment (local laptop demo only).
- Long videos, or anything beyond 30s.
- Mobile layout polish.

## Anti-goals (failure even if it "works")

- Both personas get near-identical videos.
- Garbled AI-drawn text or equations in the video. All text comes from our overlays.
- The demo stalls on a live API call with nothing to show.

## Constraints and risks

- **Time:** 1 week, one person.
- **Veo latency:** ~1+ minute per clip. Mitigated by parallel generation and showing the text first.
- **Veo cost:** see the Budget section. Also set a budget alert in AI Studio.
- **Live demo safety:** see Demo mode. Hero videos are pre-generated and served from the cache.
- **Visual consistency across 4 clips:** each shot prompt repeats a shared style/character description written by Llama.

## Left to the builder

- UI layout and styling.
- Exact JSON schema, prompt wording, and retry policy.
- File storage for generated videos (local disk is fine).
- Which Gemini TTS voices per persona.
- How progress is shown while the video generates (polling vs. streaming).
