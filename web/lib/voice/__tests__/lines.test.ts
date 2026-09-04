import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { YOGA_POSES } from '@/lib/data/poses';
import {
  FRAMING_CORRECTIONS,
  SESSION_LINES,
  buildVoiceLines,
  poseIntro,
  voiceSlug,
} from '../lines';
import { VOICE_SCRIPT } from '../script';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER_POSES = path.resolve(HERE, '../../../../server/exercises/yoga_poses.py');

describe('voiceSlug', () => {
  it('is stable for the same text', () => {
    expect(voiceSlug('Level your shoulders')).toBe(voiceSlug('Level your shoulders'));
  });

  it('changes when the wording changes', () => {
    // The point of hashing the text: an edited line misses its old clip
    // rather than playing wording the app no longer uses.
    expect(voiceSlug('Level your shoulders')).not.toBe(voiceSlug('Level your shoulder'));
  });

  it('is a safe filename', () => {
    for (const line of VOICE_SCRIPT) {
      expect(voiceSlug(line)).toMatch(/^[a-z0-9-]+-[0-9a-f]{8}$/);
    }
  });

  it('survives text with no alphanumerics of its own', () => {
    expect(voiceSlug('…')).toMatch(/^line-[0-9a-f]{8}$/);
  });

  it('gives every line in the script its own file', () => {
    const slugs = VOICE_SCRIPT.map(voiceSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('poseIntro', () => {
  it('reads straight into the first pose', () => {
    expect(poseIntro('Tree Pose', ['Root down.', 'Lift a foot.'], true)).toBe(
      'Tree Pose. Root down. Lift a foot.'
    );
  });

  it('announces the change on every pose after it', () => {
    expect(poseIntro('Tree Pose', ['Root down.'], false)).toBe(
      'Next pose. Tree Pose. Root down.'
    );
  });
});

describe('the script', () => {
  it('holds no duplicates', () => {
    expect(new Set(VOICE_SCRIPT).size).toBe(VOICE_SCRIPT.length);
  });

  it('holds nothing empty', () => {
    for (const line of VOICE_SCRIPT) expect(line.trim().length).toBeGreaterThan(0);
  });

  it('covers everything each pose can say', () => {
    for (const pose of YOGA_POSES) {
      expect(VOICE_SCRIPT, `${pose.id} first intro`).toContain(
        poseIntro(pose.name, pose.setupSteps, true)
      );
      expect(VOICE_SCRIPT, `${pose.id} later intro`).toContain(
        poseIntro(pose.name, pose.setupSteps, false)
      );
      expect(VOICE_SCRIPT, `${pose.id} hold cue`).toContain(pose.holdCue);
      expect(VOICE_SCRIPT, `${pose.id} transition cue`).toContain(pose.transitionCue);
      for (const cue of pose.cues) {
        expect(VOICE_SCRIPT, `${pose.id} correction`).toContain(cue);
      }
    }
  });

  it('covers the session lines and the spoken countdown', () => {
    for (const line of SESSION_LINES) expect(VOICE_SCRIPT).toContain(line);
  });

  it('collapses the corrections Warrior I and II share', () => {
    const all = YOGA_POSES.flatMap((p) => p.cues);
    expect(all.length).toBeGreaterThan(new Set(all).size);
    expect(new Set(VOICE_SCRIPT).size).toBe(VOICE_SCRIPT.length);
  });

  it('is empty for an empty catalog, plus the lines that are always there', () => {
    expect(buildVoiceLines([])).toEqual([...FRAMING_CORRECTIONS, ...SESSION_LINES]);
  });
});

/**
 * The one that matters.
 *
 * Every string the coach speaks that originates on the server has to have a
 * clip, and the failure mode without this test is invisible: someone rewords a
 * correction in Python, the slug stops matching, and that one line quietly
 * drops back to the robotic voice while everything around it sounds fine.
 */
describe('parity with the server', () => {
  const source = readFileSync(SERVER_POSES, 'utf8');

  const serverCorrections = [...source.matchAll(/c\.append\("([^"]+)"\)/g)].map((m) => m[1]);
  const framingCorrections = [
    ...source.matchAll(/^(?:OUT_OF_FRAME|OCCLUDED)_CORRECTION = "([^"]+)"$/gm),
  ].map((m) => m[1]);

  it('found the corrections in the Python source', () => {
    // Guards the regexes themselves — a refactor that changes how corrections
    // are written would otherwise make this whole block vacuously pass.
    expect(serverCorrections.length).toBeGreaterThanOrEqual(20);
    expect(framingCorrections).toHaveLength(2);
  });

  it('can speak every correction the coach can give', () => {
    for (const correction of serverCorrections) {
      expect(VOICE_SCRIPT, `server correction: ${correction}`).toContain(correction);
    }
  });

  it('can speak both framing cues', () => {
    expect([...FRAMING_CORRECTIONS].sort()).toEqual([...framingCorrections].sort());
    for (const correction of framingCorrections) {
      expect(VOICE_SCRIPT).toContain(correction);
    }
  });
});
