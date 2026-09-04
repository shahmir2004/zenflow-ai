'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceSlug } from '@/lib/voice/lines';
import { VOICE_SCRIPT } from '@/lib/voice/script';
import { useSpeech } from './useSpeech';

interface SpeakOptions {
  /** 'high' cancels whatever is currently being spoken first. */
  priority?: 'normal' | 'high';
  /** Suppress repeating identical text within this window (ms). */
  dedupeMs?: number;
}

const VOICE_DIR = '/voice';

/**
 * A 44-byte WAV with no samples.
 *
 * Browsers only let audio play as the result of a user gesture, and the
 * permission attaches to the *element*, not the page. Playing this during the
 * click that starts a session buys every later cue the right to play on its
 * own — without it, the coach is silent until the user happens to tap
 * something, which in a hands-free yoga session is never.
 */
const SILENCE =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=';

/**
 * The coach's voice: pre-rendered clips where they exist, browser speech
 * synthesis where they do not.
 *
 * Same shape as `useSpeech`, which it falls back to, so no call site knows the
 * difference. That fallback is the whole safety story — a tree with no audio
 * rendered, or a line someone edited without re-running the renderer, behaves
 * exactly as the app did before this existed rather than going quiet.
 *
 * Two rules differ from plain synthesis, both because a clip is a fixed length
 * that cannot be hurried:
 *
 *  - **Nothing queues.** A cue that has waited behind a fourteen-second
 *    introduction is describing a body position from fourteen seconds ago.
 *  - **Nothing interrupts a high-priority line.** Introductions, hold cues and
 *    transitions are the coach speaking in sentences; a correction arriving
 *    mid-sentence is dropped rather than cutting it off.
 */
export function useVoice() {
  const fallback = useSpeech();
  const { speak: speakFallback, cancel: cancelFallback, setMuted: setFallbackMuted } = fallback;

  const [muted, setMutedState] = useState(false);
  const mutedRef = useRef(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Both a resolved value and a promise: `speak` has to decide synchronously
  // and falls back if the manifest has not landed yet, while `prefetch` can
  // afford to wait — and must, or an early click silently warms nothing.
  const slugsRef = useRef<Set<string> | null>(null);
  const manifestRef = useRef<Promise<Set<string>> | null>(null);
  const playingPriorityRef = useRef<'normal' | 'high' | null>(null);
  const lastSpokenRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  /* ── the element, and what it is allowed to play ────────────────────── */

  useEffect(() => {
    const el = new Audio();
    el.preload = 'auto';
    const clearPriority = () => {
      playingPriorityRef.current = null;
    };
    el.addEventListener('ended', clearPriority);
    el.addEventListener('error', clearPriority);
    audioRef.current = el;

    return () => {
      el.removeEventListener('ended', clearPriority);
      el.removeEventListener('error', clearPriority);
      el.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    manifestRef.current = fetch(`${VOICE_DIR}/manifest.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { slugs?: string[] } | null) =>
        // An absent or malformed manifest is not an error — it means nothing
        // has been rendered, and every line takes the synthesis path.
        new Set(Array.isArray(data?.slugs) ? data.slugs : [])
      )
      .catch(() => new Set<string>());

    manifestRef.current.then((slugs) => {
      slugsRef.current = slugs;
    });
  }, []);

  /* ── controls ───────────────────────────────────────────────────────── */

  const cancel = useCallback(() => {
    playingPriorityRef.current = null;
    audioRef.current?.pause();
    cancelFallback();
  }, [cancelFallback]);

  /** Call from a user gesture — the click that starts a session will do. */
  const prime = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    el.src = SILENCE;
    el.play().catch(() => {
      // Blocked anyway. Nothing to do; the fallback voice has the same
      // constraint and the session is still perfectly usable in silence.
    });
  }, []);

  const setMuted = useCallback(
    (value: boolean) => {
      mutedRef.current = value;
      setMutedState(value);
      setFallbackMuted(value);
      if (value) {
        playingPriorityRef.current = null;
        audioRef.current?.pause();
      }
    },
    [setFallbackMuted]
  );

  const speak = useCallback(
    (text: string, opts: SpeakOptions = {}) => {
      if (!text || mutedRef.current) return;

      const { priority = 'normal', dedupeMs = 5000 } = opts;

      const now = Date.now();
      if (text === lastSpokenRef.current.text && now - lastSpokenRef.current.at < dedupeMs) {
        return;
      }

      // Let the coach finish its sentence.
      if (priority === 'normal' && playingPriorityRef.current === 'high') return;

      lastSpokenRef.current = { text, at: now };

      /*
       * Silence both channels before starting a high-priority line. A clip and
       * a synthesised line are independent outputs, so cancelling only the one
       * about to be used would leave the other talking over it — audible as
       * two voices whenever a rendered cue interrupts a fallback one, or the
       * reverse.
       */
      if (priority === 'high') {
        audioRef.current?.pause();
        cancelFallback();
        playingPriorityRef.current = null;
      }

      const el = audioRef.current;
      const slug = voiceSlug(text);
      const haveClip = el !== null && slugsRef.current?.has(slug) === true;

      if (!haveClip) {
        // Dedupe is already done here, so don't let it happen twice.
        speakFallback(text, { priority, dedupeMs: 0 });
        return;
      }

      playingPriorityRef.current = priority;
      el.pause();
      el.src = `${VOICE_DIR}/${slug}.m4a`;
      el.play().catch(() => {
        playingPriorityRef.current = null;
      });
    },
    [speakFallback, cancelFallback]
  );

  /**
   * Pull the whole script into the browser's cache.
   *
   * Around 2MB, fetched once when a session starts so no cue ever waits on the
   * network — the same trade the MediaPipe model already makes, and the reason
   * the coach still works when the wifi at a demo does not.
   */
  const prefetch = useCallback(() => {
    void manifestRef.current?.then((slugs) => {
      for (const line of VOICE_SCRIPT) {
        const slug = voiceSlug(line);
        if (slugs.has(slug)) void fetch(`${VOICE_DIR}/${slug}.m4a`).catch(() => {});
      }
    });
  }, []);

  useEffect(() => cancel, [cancel]);

  return {
    speak,
    cancel,
    prime,
    prefetch,
    muted,
    setMuted,
    supported: true,
  };
}
