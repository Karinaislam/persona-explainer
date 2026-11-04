// Usage: npx tsx --env-file=.env.local scripts/smoke.ts still|tts
import { generateStill, synthesizeSpeech } from '../lib/meta'

const which = process.argv[2]
const out = 'data/smoke'

async function main() {
  if (which === 'still') await generateStill('Bright cartoon infographic: a football falling onto a sunny pitch with an arrow labeled "PULL"', `${out}/still.webp`)
  else if (which === 'tts') console.log(await synthesizeSpeech(['Gravity is the invisible pull.', 'It brings your football back down!'], `${out}/voice.wav`))
  else throw new Error('arg: still | tts')
  console.log(`ok: ${which} -> ${out}`)
}
main().catch(e => { console.error(e); process.exit(1) })
