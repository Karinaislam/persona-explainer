// Pre-generates every preset for every persona so the demo plays instantly from cache.
// Usage: npx tsx --env-file=.env.local scripts/pregen.ts
import { PERSONAS } from '../lib/personas'
import { PRESETS } from '../lib/presets'
import { cacheKey, readScript, writeScript } from '../lib/cache'
import { generateScript, isCurrentScript } from '../lib/llama'
import { renderVideo } from '../lib/pipeline'
import { reviewVideo } from '../lib/review'

async function main() {
  let failed = 0
  for (const preset of PRESETS) {
    for (const persona of PERSONAS) {
      const key = cacheKey(persona.id, preset.question)
      const label = `${persona.name} / ${preset.question}`
      const t = Date.now()
      try {
        let script = readScript(key)
        if (!isCurrentScript(script)) writeScript(key, (script = await generateScript(persona, preset.question)))
        await renderVideo(key, persona, script)
        const r = await reviewVideo(key, persona, script)
        console.log(`✓ ${label} (${Math.round((Date.now() - t) / 1000)}s) Wonder ${r.wonder.score}/10, voice ${Math.round(r.voiceAccuracy * 100)}%`)
      } catch (e) {
        failed++
        console.error(`✗ ${label}: ${e instanceof Error ? e.message : e}`)
      }
    }
  }
  process.exit(failed ? 1 : 0)
}
main()
