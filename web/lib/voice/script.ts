/**
 * The script bound to this app's pose catalog.
 *
 * Split from lines.ts purely so that module can import nothing — the renderer
 * loads it under plain Node, which cannot resolve the `@/` alias.
 */

import { YOGA_POSES } from '@/lib/data/poses';
import { buildVoiceLines } from './lines';

export const VOICE_SCRIPT: string[] = buildVoiceLines(YOGA_POSES);
