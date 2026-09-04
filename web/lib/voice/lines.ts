/**
 * Every line the coach can say, and how to name its audio file.
 *
 * A yoga app's spoken vocabulary is *closed*. There is no user-generated text
 * in a session: every pose introduction, hold cue, transition and correction
 * is fixed before the app ships, and the only numbers spoken are the last
 * three seconds of a hold. That makes the whole script — around sixty
 * utterances — renderable ahead of time.
 *
 * Which is the point. Browser speech synthesis is free and instant but sounds
 * like a train announcement, and a neural voice good enough to guide a
 * meditation is either a 90MB model download or a metered API. Rendering the
 * fixed script once, offline, gets the good voice at neither cost: the app
 * ships ~2MB of audio, plays it with no network and no model, and sounds
 * identical every time.
 *
 * `tools/voice/render.mjs` imports this module directly under Node, so the app
 * and the renderer can never disagree about the script. That is why nothing
 * here imports a value — the only import is a type, which Node erases. The
 * pose catalog arrives as an argument instead.
 */

import type { YogaPose } from '@/lib/data/poses';

/** The two framing cues, verbatim from server/exercises/yoga_poses.py. */
export const FRAMING_CORRECTIONS = [
  'Step back so your whole body is in the camera frame',
  'Face the camera and make sure the room is bright enough',
];

/** Lines that belong to the session itself rather than to any one pose. */
export const SESSION_LINES = [
  'Session complete. Wonderful work.',
  // The spoken countdown over the last three seconds of a hold.
  '1',
  '2',
  '3',
];

/**
 * How `useYogaFlow.enterStep` assembles a pose introduction.
 *
 * Kept here as one function so the renderer produces exactly the string the
 * app asks for. An introduction that differs by a single word is a cache miss,
 * and that pose silently drops back to the robotic voice.
 */
export function poseIntro(poseName: string, setupSteps: string[], isFirst: boolean): string {
  return (isFirst ? '' : 'Next pose. ') + `${poseName}. ` + setupSteps.join(' ');
}

/**
 * The complete script, de-duplicated, in a stable order.
 *
 * Takes the catalog rather than importing it so this module stays loadable by
 * plain Node — see the note at the top.
 */
export function buildVoiceLines(poses: YogaPose[]): string[] {
  const lines: string[] = [];

  for (const pose of poses) {
    lines.push(poseIntro(pose.name, pose.setupSteps, true));
    lines.push(poseIntro(pose.name, pose.setupSteps, false));
    lines.push(pose.holdCue);
    lines.push(pose.transitionCue);
    // Warrior I and II share three of these; the Set below collapses them.
    lines.push(...pose.cues);
  }

  lines.push(...FRAMING_CORRECTIONS);
  lines.push(...SESSION_LINES);

  return [...new Set(lines)];
}

/**
 * A stable filename for a line.
 *
 * FNV-1a over the exact text, so the same words always resolve to the same
 * file and any edit — even a comma — produces a different one and misses the
 * cache rather than playing the old wording. The readable prefix is purely so
 * the directory can be skimmed by a human.
 */
export function voiceSlug(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  const prefix = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/, '');

  return `${prefix || 'line'}-${hash.toString(16).padStart(8, '0')}`;
}
