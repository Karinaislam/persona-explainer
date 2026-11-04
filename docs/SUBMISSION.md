# Submission answers (copy into the form)

## Project Description

Persona Explainer turns one question into a lesson, a narrated explainer video and a self-checked script, all tailored to who is asking.

The problem: one explanation never fits everyone. A textbook answer to "How does gravity work?" is too dense for a 10-year-old and too shallow for an engineering student. Good teachers adapt to the learner's level, interests and the examples that click for them, but most learners never get that.

Pick a learner, or create one in a sentence ("a 68-year-old retired farmer who loves tractors") and Muse Spark builds the full profile: interests, level, tone and the video style they'd enjoy. Then ask anything. Ayaan, 10, who loves football, gets a playful lesson with no formulas, a worked example about kicking his ball, and a cartoon infographic video. Sara, a first-year engineering student, gets Newton's law with units, a hoist-sizing calculation with a safety factor, and a technical infographic video. Every answer has a summary, 3-5 explanatory sections, a worked example, a recap and a takeaway, written with rules that avoid common misconceptions and keep the math at the learner's level.

Each answer comes with a ~30-second explainer video: four infographic scenes with drawn-in titles, a narrated voiceover and captions timed to the real voice, playable in the page and downloadable as MP4, plus the full scene-by-scene script.

Then the app checks its own work. Muse Wonder watches the finished video and scores each scene against the script, flagging real problems (it caught gravity arrows pointing up and a compass with "W" where "E" should be). Muse Voice Transcribe listens to the narration and reports how much was spoken correctly. Learners and teachers see the quality report before they trust the video.

## Describe your use of Meta products to build the submitted project

The whole pipeline runs on Meta models; no other AI provider is used.

- Muse Spark (Meta Model API) writes the persona-tailored lesson and a 4-scene video script as structured JSON (narration, visual prompt, title per scene), and turns a one-line description into a complete learner persona. Output is validated with a schema and retried if malformed.
- Muse Image (Meta Model API) draws each scene as an infographic, including its title text, while keeping the bottom of the frame clear for captions.
- MMS-TTS (Meta open weights, facebook/mms-tts-eng) runs locally with transformers.js and voices the narration scene by scene. Because each scene is voiced separately, the app knows exactly when each scene starts, so scene lengths and captions follow the real voice.
- Muse Wonder (Meta Model API) watches the finished MP4 (video input) and reviews it against the script, returning an overall score, a per-scene score and concrete issues.
- Muse Voice Transcribe (Meta Model API, /asr/transcribe) transcribes our own narration so we can score how accurately it was spoken. This exposed a real issue (the TTS garbled symbols like "m/s²"), which we fixed by having Muse Spark write narration fully in words.

ffmpeg only animates, captions and stitches. Everything is cached per learner and question, so demo questions replay instantly.

## Why are Meta's models important to your solution?

The product needs one family of models that can write, draw, listen and watch, and Meta's covers all four. Muse Spark is strong at structured, level-aware teaching: the same question produces genuinely different lessons for a child and an engineer, with accurate physics. Muse Image renders readable, correctly spelled text inside images, which is what makes infographic scenes possible; a non-Meta video model we tried earlier garbled labels and equations. Muse Wonder can take a whole video as input, which is what lets the app review its own output instead of trusting it blindly, and Muse Voice Transcribe closes the loop on the audio. Meta's open-weight MMS-TTS lets the narration run locally at no cost. Together they turn "generate a video" into "generate, then verify", which matters for learning content, where a wrong arrow teaches the wrong physics.
