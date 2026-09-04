'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeakOptions {
  /** 'high' cancels whatever is currently being spoken first. */
  priority?: 'normal' | 'high';
  /** Suppress repeating identical text within this window (ms). */
  dedupeMs?: number;
}

/**
 * Browser text-to-speech via the Web Speech API. Free, offline, no API key.
 *
 * Two rules keep it usable during a hold, both enforced here rather than at
 * every call site: de-dupe, because correction_message can change every frame
 * while someone wobbles; and cancel-before-speak, because otherwise a 20s hold
 * produces a 40s backlog of stale cues that keeps talking after the pose is
 * already right.
 */
export function useSpeech() {
  const [muted, setMutedState] = useState(false);
  const [supported, setSupported] = useState(false);
  const mutedRef = useRef(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const lastSpokenRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    setSupported(true);

    /*
     * Ranked, because the installed voices differ enormously in quality and
     * picking the first English one is how you end up with Microsoft Zira.
     *
     * "Natural" and "Neural" name the modern server-backed voices that Edge
     * and Chrome expose on Windows; Google's network voices are the next best;
     * Samantha is macOS's. Everything below that is a formant synthesiser from
     * the 2000s, which is what "robotic" means in practice.
     */
    const RANKED = [/natural|neural/i, /google/i, /samantha|karen|moira/i, /female/i];

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const english = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'));
      voiceRef.current =
        RANKED.reduce<SpeechSynthesisVoice | null>(
          (found, pattern) => found ?? english.find((v) => pattern.test(v.name)) ?? null,
          null
        ) ||
        english[0] ||
        voices[0] ||
        null;
    };

    pickVoice();
    // Voices load asynchronously in Chrome; the first getVoices() is often [].
    window.speechSynthesis.addEventListener('voiceschanged', pickVoice);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', pickVoice);
  }, []);

  const cancel = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const setMuted = useCallback(
    (value: boolean) => {
      mutedRef.current = value;
      setMutedState(value);
      if (value) cancel();
    },
    [cancel]
  );

  const speak = useCallback((text: string, opts: SpeakOptions = {}) => {
    if (!text) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (mutedRef.current) return;

    const { priority = 'normal', dedupeMs = 5000 } = opts;
    const now = Date.now();
    if (text === lastSpokenRef.current.text && now - lastSpokenRef.current.at < dedupeMs) {
      return;
    }
    lastSpokenRef.current = { text, at: now };

    const synth = window.speechSynthesis;
    if (priority === 'high') synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) utterance.voice = voiceRef.current;
    // Matches the speed the clips in public/voice are rendered at, so dropping
    // to this fallback changes the voice but not the pace of the session.
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    synth.speak(utterance);
  }, []);

  // Stop any speech when the consuming component unmounts — otherwise leaving
  // the session mid-cue keeps talking over the landing page.
  useEffect(() => cancel, [cancel]);

  return { speak, cancel, muted, setMuted, supported };
}
