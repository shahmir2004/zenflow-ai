import type { SessionSummary } from '@/lib/hooks/useYogaFlow';

export type SessionMode = 'single' | 'flow' | 'plan';

/**
 * A finished session, in the shape the database stores it.
 *
 * Guest sessions in localStorage use this exact shape too, so migrating one
 * into an account on first sign-in is a straight insert with no translation —
 * which is what stops the two paths drifting apart.
 */
export interface SessionRecord {
  mode: SessionMode;
  startedAt: string;
  endedAt: string;
  totalHeldSeconds: number;
  posesToTarget: number;
  totalPoses: number;
  planId: string | null;
  poses: {
    position: number;
    poseId: string;
    heldSeconds: number;
    targetSeconds: number;
    reachedTarget: boolean;
  }[];
  corrections: {
    poseId: string;
    correction: string;
    count: number;
  }[];
  snapshots: {
    poseId: string;
    correction: string;
    landmarks: { x: number; y: number; z: number; visibility: number }[];
    jointColors: Record<string, string>;
  }[];
}

/** Flatten what the session produced into what gets stored. */
export function toSessionRecord(
  summary: SessionSummary,
  mode: SessionMode,
  planId: string | null = null
): SessionRecord {
  return {
    mode,
    startedAt: summary.startedAt,
    endedAt: summary.endedAt,
    totalHeldSeconds: Math.round(summary.totalHeldSeconds * 100) / 100,
    posesToTarget: summary.posesToTarget,
    totalPoses: summary.totalPoses,
    planId,
    poses: summary.poses.map((pose, index) => ({
      position: index,
      poseId: pose.poseId,
      heldSeconds: pose.heldSeconds,
      targetSeconds: pose.targetSeconds,
      reachedTarget: pose.reachedTarget,
    })),
    corrections: summary.toFixNext.map((entry) => ({
      poseId: entry.poseId,
      correction: entry.correction,
      count: entry.count,
    })),
    snapshots: summary.snapshots.map((snapshot) => ({
      poseId: snapshot.poseId,
      correction: snapshot.correction,
      landmarks: snapshot.landmarks,
      jointColors: snapshot.jointColors,
    })),
  };
}

/**
 * A session with nothing in it is not worth keeping. Closing the camera by
 * accident should not put a 0-second entry in someone's history or count
 * toward their streak.
 */
export function isWorthSaving(record: SessionRecord): boolean {
  return record.poses.length > 0 && record.totalHeldSeconds > 0;
}
