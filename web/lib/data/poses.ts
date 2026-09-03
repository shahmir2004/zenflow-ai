/**
 * The pose catalog — content for the library, the detail sheet, and the spoken
 * script.
 *
 * `id`, `cameraView` and `holdTargetSeconds` MUST match the backend
 * (exercises/yoga_registry.py). lib/data/__tests__/catalog.test.ts asserts that
 * parity, and lib/hooks/useCatalogParity.ts re-checks it against the live
 * /api/yoga/poses response in development. Everything else on this type is
 * content the backend does not carry.
 *
 * `cues` are the coach's ACTUAL correction strings, copied from
 * `c.append(...)` in backend/exercises/yoga_poses.py. The detail sheet is
 * headed "What the coach listens for", so a paraphrase there would promise one
 * thing and speak another. Note these differ slightly from the design
 * handoff's cue list, which was synced from an earlier revision of the
 * backend — the running code wins.
 */

import type { YogaCameraView } from '@/lib/contracts/yoga';

export type YogaDifficulty = 'beginner' | 'intermediate';

export interface YogaPose {
  id: string;
  name: string;
  /** Chip label — the full name does not fit the live control bar. */
  short: string;
  sanskrit: string;
  difficulty: YogaDifficulty;
  cameraView: YogaCameraView;
  holdTargetSeconds: number;
  description: string;
  /** Spoken one by one as the user enters the pose. */
  setupSteps: string[];
  /** Spoken once the pose is reached and the hold begins. */
  holdCue: string;
  /** Spoken when the hold completes, guiding the change of position. */
  transitionCue: string;
  /** What the coach checks — verbatim from the backend's corrections. */
  cues: string[];
}

export const YOGA_POSES: YogaPose[] = [
  {
    id: 'mountain',
    name: 'Mountain Pose',
    short: 'Mountain',
    sanskrit: 'Tadasana',
    difficulty: 'beginner',
    cameraView: 'front',
    holdTargetSeconds: 15,
    description:
      'The foundation of all standing poses. Stand tall and grounded, building steady, balanced posture.',
    setupSteps: [
      'Stand with your feet together and arms relaxed at your sides.',
      'Lengthen your spine and stack your shoulders over your hips.',
      'Press evenly through both feet and gaze straight ahead.',
    ],
    holdCue: 'Hold Mountain Pose. Breathe steadily and stand tall.',
    transitionCue: 'Release. Gently shake out your legs before the next pose.',
    cues: [
      'Straighten your legs and stand tall',
      'Stack your shoulders over your hips and stand straight',
      'Level your shoulders',
    ],
  },
  {
    id: 'tree',
    name: 'Tree Pose',
    short: 'Tree',
    sanskrit: 'Vrksasana',
    difficulty: 'beginner',
    cameraView: 'front',
    holdTargetSeconds: 20,
    description:
      'A standing balance pose that strengthens the legs and core while improving focus.',
    setupSteps: [
      'Shift your weight onto one leg and root it firmly into the floor.',
      'Place the sole of your other foot on your inner calf or thigh.',
      'Bring your palms together at your chest or reach them overhead.',
    ],
    holdCue: 'Hold Tree Pose. Fix your gaze on one point to steady your balance.',
    transitionCue: 'Lower your foot to the floor. We will balance on the other side or move on.',
    cues: [
      'Lift one foot and place the sole on your inner thigh or calf',
      'Straighten and root down through your standing leg',
      'Engage your core and fix your gaze on one point',
    ],
  },
  {
    id: 'warrior_i',
    name: 'Warrior I',
    short: 'Warrior I',
    sanskrit: 'Virabhadrasana I',
    difficulty: 'intermediate',
    cameraView: 'front',
    holdTargetSeconds: 20,
    description:
      'A powerful standing pose that opens the chest and hips while strengthening the legs.',
    setupSteps: [
      'Step one foot back into a long stance, both feet pressing down.',
      'Bend your front knee toward ninety degrees, over your ankle.',
      'Reach both arms straight up overhead and lift your chest.',
    ],
    holdCue: 'Hold Warrior One. Sink into the front knee and reach tall through your arms.',
    transitionCue: 'Straighten your front leg and lower your arms to step out of the pose.',
    cues: [
      'Bend your front knee to about 90 degrees, stacked over the ankle',
      'Straighten and press through your back leg',
      'Lift your chest and keep your torso upright',
      'Reach both arms straight up alongside your ears',
    ],
  },
  {
    id: 'warrior_ii',
    name: 'Warrior II',
    short: 'Warrior II',
    sanskrit: 'Virabhadrasana II',
    difficulty: 'intermediate',
    cameraView: 'front',
    holdTargetSeconds: 25,
    description:
      'A grounding warrior pose that builds stamina and opens the hips, with arms reaching wide.',
    setupSteps: [
      'Take a wide stance and turn your front foot out.',
      'Bend your front knee over your ankle, keeping the back leg strong.',
      'Extend your arms out to the sides, parallel to the floor.',
    ],
    holdCue: 'Hold Warrior Two. Reach actively through both arms and gaze over your front hand.',
    transitionCue: 'Straighten your front leg and lower your arms to release.',
    cues: [
      'Bend your front knee to about 90 degrees, stacked over the ankle',
      'Straighten and press through your back leg',
      'Lift your chest and keep your torso upright',
      'Extend both arms parallel to the floor, reaching out wide',
    ],
  },
  {
    id: 'chair',
    name: 'Chair Pose',
    short: 'Chair',
    sanskrit: 'Utkatasana',
    difficulty: 'beginner',
    cameraView: 'front',
    holdTargetSeconds: 20,
    description:
      'A strengthening pose for the legs and core, like sitting back into an invisible chair.',
    setupSteps: [
      'Stand with your feet together or hip-width apart.',
      'Bend your knees and sit your hips back and down.',
      'Reach your arms up alongside your ears.',
    ],
    holdCue: 'Hold Chair Pose. Keep your weight in your heels and your chest lifted.',
    transitionCue: 'Press through your feet to stand, and lower your arms.',
    cues: [
      'Bend your knees and sit your hips back as if into a chair',
      'Reach your arms up alongside your ears',
    ],
  },
  {
    id: 'triangle',
    name: 'Triangle Pose',
    short: 'Triangle',
    sanskrit: 'Trikonasana',
    difficulty: 'intermediate',
    cameraView: 'front',
    holdTargetSeconds: 20,
    description:
      'A wide-legged side stretch that lengthens the torso and opens the hips and chest.',
    setupSteps: [
      'Step your feet wide apart, legs straight and strong.',
      'Reach toward your front foot and hinge sideways from your hip.',
      'Lower your bottom hand toward your shin and stack the top arm upward.',
    ],
    holdCue: 'Hold Triangle Pose. Lengthen both sides of your waist and open your chest.',
    transitionCue: 'Press into your feet to rise back up, then face forward.',
    cues: [
      'Straighten both legs in your wide stance',
      'Hinge sideways from your hip, reaching one hand down',
      'Stack your top arm over the bottom, forming one straight line',
    ],
  },
  {
    id: 'downward_dog',
    name: 'Downward Dog',
    short: 'Down dog',
    sanskrit: 'Adho Mukha Svanasana',
    difficulty: 'beginner',
    cameraView: 'side',
    holdTargetSeconds: 20,
    description:
      'A whole-body pose that stretches the hamstrings and shoulders while building strength.',
    setupSteps: [
      'Turn so your side faces the camera for this pose.',
      'Come onto your hands and knees, hands under shoulders.',
      'Tuck your toes and lift your hips up and back into an upside-down V.',
    ],
    holdCue: 'Hold Downward Dog. Press the floor away and send your hips high.',
    transitionCue: 'Lower your knees to the floor to come out gently.',
    cues: [
      'Lift your hips up and back to make an upside-down V',
      'Press the floor away and straighten your arms',
      'Straighten your legs, sending your heels toward the floor',
      'Form a clear peak at the hips between your arms and legs',
    ],
  },
  {
    id: 'cobra',
    name: 'Cobra Pose',
    short: 'Cobra',
    sanskrit: 'Bhujangasana',
    difficulty: 'beginner',
    cameraView: 'side',
    holdTargetSeconds: 15,
    description:
      'A gentle backbend that strengthens the spine and opens the chest.',
    setupSteps: [
      'Turn so your side faces the camera for this pose.',
      'Lie face down with your hands under your shoulders.',
      'Press into your hands and lift your chest, keeping your hips on the floor.',
    ],
    holdCue: 'Hold Cobra Pose. Draw your shoulders back and lengthen through the chest.',
    transitionCue: 'Lower your chest back to the floor to release.',
    cues: [
      'Press through your hands and lift your chest off the floor',
      'Keep your hips and the tops of your thighs grounded',
    ],
  },
];

export const YOGA_POSE_BY_ID: Record<string, YogaPose> = Object.fromEntries(
  YOGA_POSES.map((p) => [p.id, p])
);

export function getYogaPose(id: string | null | undefined): YogaPose | undefined {
  return id ? YOGA_POSE_BY_ID[id] : undefined;
}

/** Initials for the live pose badge, e.g. "Warrior II" -> "W2", "Tree" -> "TR". */
export function poseInitials(pose: YogaPose): string {
  const words = pose.name.replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const second = words[1];
    // "Warrior II" -> W + 2 reads better than W + I.
    const roman: Record<string, string> = { I: '1', II: '2', III: '3' };
    return (words[0][0] + (roman[second] ?? second[0])).toUpperCase();
  }
  return pose.name.slice(0, 2).toUpperCase();
}

/**
 * Floor poses are read from a side view at floor height and detect less
 * reliably than standing poses — the backend's own docs call them the weak
 * link. The UI surfaces this rather than letting a user blame their form.
 */
export function needsSideView(pose: YogaPose): boolean {
  return pose.cameraView === 'side';
}
