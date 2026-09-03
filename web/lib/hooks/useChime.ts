'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * A soft two-note bell for hold completion, synthesised with WebAudio.
 *
 * No audio file: a sine pair with an exponential decay is both smaller than
 * any asset and easier to keep in the app's register — a sampled "ding" would
 * read as a notification, which is the wrong feeling at the end of a hold.
 *
 * AudioContext starts suspended until a user gesture, so `unlock` is called
 * from the same click that starts the session.
 */
export function useChime() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
    }
    return ctxRef.current;
  }, []);

  /** Call from a user gesture so the chime can play later without one. */
  const unlock = useCallback(() => {
    const ctx = getContext();
    if (ctx?.state === 'suspended') void ctx.resume();
  }, [getContext]);

  const chime = useCallback(() => {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    // A perfect fifth, struck a beat apart — resolved rather than alerting.
    const notes = [
      { freq: 587.33, at: 0, gain: 0.16 },   // D5
      { freq: 880.0, at: 0.14, gain: 0.11 }, // A5
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note.freq;

      const start = now + note.at;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(note.gain, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.6);

      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1.7);
    }
  }, [getContext]);

  useEffect(() => {
    return () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  return { chime, unlock };
}
