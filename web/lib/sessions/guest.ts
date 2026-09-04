'use client';

import type { SessionRecord } from './types';

const KEY = 'zenflow.guest-sessions';

/**
 * Practice done without an account.
 *
 * The landing page promises no account is needed, so a guest session has to be
 * worth as much as a signed-in one until the moment it can be claimed. These
 * are held locally and handed over on first sign-in.
 */
export function readGuestSessions(): SessionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SessionRecord[]) : [];
  } catch {
    // Private mode, disabled storage, or corrupt JSON.
    return [];
  }
}

/** Newest first, capped — this is a holding pen, not a history. */
const MAX_GUEST_SESSIONS = 25;

export function appendGuestSession(record: SessionRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const next = [record, ...readGuestSessions()].slice(0, MAX_GUEST_SESSIONS);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable. The summary still shows on screen; only
    // the record is lost, and there is nothing useful to say about it here.
  }
}

export function clearGuestSessions(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

export function guestSessionCount(): number {
  return readGuestSessions().length;
}
