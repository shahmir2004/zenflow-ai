/**
 * Renders the coach's fixed script to audio with Kokoro-82M.
 *
 * Run once (or after editing any spoken line); commit the output. The app then
 * has a natural voice with no model download, no API key, no per-play cost and
 * no network at all — see web/lib/voice/lines.ts for why the script can be
 * closed-set in the first place.
 *
 * This package is deliberately not a devDependency of web/: onnxruntime pulls
 * in a couple of hundred megabytes, and Vercel installs devDependencies during
 * a build.
 *
 *   cd tools/voice && npm install && npm run render
 *
 * Options:
 *   --voice <id>    Kokoro voice (default af_heart, the highest-graded)
 *   --speed <n>     0.9 is a little slower than natural, which suits a hold
 *   --dtype <t>     q8 (default, 92MB download) | fp32 (326MB, best quality)
 *   --force         Re-render lines that already have a file
 */

import { execFile } from 'node:child_process';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ffmpegPath from 'ffmpeg-static';
import { KokoroTTS } from 'kokoro-js';

import { YOGA_POSES } from '../../web/lib/data/poses.ts';
import { buildVoiceLines, voiceSlug } from '../../web/lib/voice/lines.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '../../web/public/voice');
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}
const VOICE = arg('voice', 'af_heart');
const SPEED = Number(arg('speed', '0.9'));
const DTYPE = arg('dtype', 'q8');
const FORCE = process.argv.includes('--force');

/**
 * Trim silence from the head and tail, and only from the head and tail.
 *
 * Kokoro pads every utterance — measured at ~0.4s before the first word and
 * ~0.5s after the last. On a cue that is meant to land the instant a fault
 * appears that is a noticeable lag, and on the spoken countdown it is fatal:
 * the digits are a second apart and each one cancels the last, so a clip that
 * opens with 0.4s of nothing gets cut off before it says anything.
 *
 * The reverse-trim-reverse idiom is deliberate. `silenceremove` with
 * `stop_periods=-1` would also collapse the pauses *between* sentences, which
 * in a fourteen-second pose introduction is exactly the pacing that makes it
 * sound like a person. Trimming the front, reversing, trimming the new front,
 * and reversing back touches only the ends.
 */
const TRIM_ENDS = [
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03',
  'areverse',
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03',
  'areverse',
].join(',');

/**
 * AAC in an .m4a container, mono, 48kbps.
 *
 * Not Opus: it is smaller at the same quality but its browser support depends
 * on the container, and this has to play on a phone at a demo. AAC plays
 * everywhere with no caveats, and the whole script still fits in ~2MB.
 */
async function toAac(wavBuffer, outPath) {
  const ffmpeg = execFile(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'wav', '-i', 'pipe:0',
    '-af', TRIM_ENDS,
    '-ac', '1', '-c:a', 'aac', '-b:a', '48k',
    '-y', outPath,
  ]);

  const done = new Promise((resolve, reject) => {
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))
    );
  });

  ffmpeg.stdin.end(Buffer.from(wavBuffer));
  await done;
}

async function main() {
  const lines = buildVoiceLines(YOGA_POSES);
  console.log(`${lines.length} lines · voice ${VOICE} · speed ${SPEED} · dtype ${DTYPE}`);

  await mkdir(OUT_DIR, { recursive: true });
  const existing = new Set(
    (await readdir(OUT_DIR).catch(() => [])).filter((f) => f.endsWith('.m4a'))
  );

  // Anything left over from a previous script is stale by definition: the slug
  // is a hash of the text, so an edited line leaves its old file behind.
  const wanted = new Set(lines.map((line) => `${voiceSlug(line)}.m4a`));
  for (const file of existing) {
    if (!wanted.has(file)) {
      await rm(path.join(OUT_DIR, file));
      console.log(`  removed stale ${file}`);
    }
  }

  const todo = lines.filter((line) => FORCE || !existing.has(`${voiceSlug(line)}.m4a`));
  if (todo.length === 0) {
    console.log('Everything is already rendered. Use --force to redo it.');
  } else {
    console.log(`Loading Kokoro (${DTYPE})… first run downloads the model.`);
    const tts = await KokoroTTS.from_pretrained(MODEL_ID, { dtype: DTYPE, device: 'cpu' });

    let done = 0;
    for (const line of todo) {
      const slug = voiceSlug(line);
      const audio = await tts.generate(line, { voice: VOICE, speed: SPEED });
      await toAac(audio.toWav(), path.join(OUT_DIR, `${slug}.m4a`));
      done += 1;
      const preview = line.length > 56 ? `${line.slice(0, 53)}…` : line;
      console.log(`  [${String(done).padStart(2)}/${todo.length}] ${preview}`);
    }
  }

  await writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    `${JSON.stringify(
      {
        voice: VOICE,
        speed: SPEED,
        model: MODEL_ID,
        dtype: DTYPE,
        slugs: lines.map(voiceSlug).sort(),
      },
      null,
      2
    )}\n`
  );

  console.log(`Wrote ${lines.length} clips + manifest.json to web/public/voice/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
