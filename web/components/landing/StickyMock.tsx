'use client';

import { PoseFigure } from '@/components/PoseFigure';
import { YOGA_POSES } from '@/lib/data/poses';
import styles from './StickyMock.module.css';

const PICKER_POSES = ['mountain', 'tree', 'warrior_i', 'warrior_ii', 'chair'];
const ACTIVE_POSE = 'warrior_ii';

/** r=42 circumference, to two places. */
const RING_CIRCUMFERENCE = 264;
const DEMO_PROGRESS = 0.68;

/**
 * The pinned preview beside the three steps. Each region belongs to exactly
 * one step and is invisible otherwise — at opacity 0, not a dim value. A
 * ghosted cue line sitting over the figure reads as muddy text rather than as
 * something switched off.
 */
export function StickyMock({ activeStep }: { activeStep: number }) {
  const isFramingStep = activeStep === 0;
  const isPickerStep = activeStep === 1;
  const isCoachingStep = activeStep === 2;

  return (
    <div className={styles.mock}>
      <div className={styles.ground} />
      <div className={styles.vignette} />

      {/* The figure is always present — it is the person, not a step. */}
      <div className={styles.figure}>
        <PoseFigure
          poseId={ACTIVE_POSE}
          ground={false}
          flags={isCoachingStep ? { lk: 'fix' } : undefined}
        />
      </div>

      {/* 1 — framing */}
      <div className={styles.region} data-lit={isFramingStep}>
        <span className={`mono ${styles.frameLabel}`}>whole body in frame</span>
        <div className={styles.frameBox} />
      </div>

      {/* 2 — pose picker */}
      <div className={styles.region} data-lit={isPickerStep}>
        <div className={styles.picker}>
          {PICKER_POSES.map((id) => {
            const pose = YOGA_POSES.find((p) => p.id === id);
            if (!pose) return null;
            return (
              <span
                key={id}
                className={styles.chip}
                data-active={id === ACTIVE_POSE}
              >
                {pose.short}
              </span>
            );
          })}
        </div>
      </div>

      {/* 3 — the coaching itself: a hold ring and one spoken correction */}
      <div className={styles.region} data-lit={isCoachingStep}>
        <div className={styles.holdRing}>
          <svg viewBox="0 0 100 100" className={styles.ringSvg} aria-hidden="true">
            <circle cx="50" cy="50" r="42" className={styles.ringTrack} />
            <circle
              cx="50"
              cy="50"
              r="42"
              className={styles.ringFill}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - DEMO_PROGRESS)}
            />
          </svg>
          <div className={styles.ringReadout}>
            <span className={styles.ringSeconds}>17s</span>
            <span className={`mono ${styles.ringTarget}`}>of 25s</span>
          </div>
        </div>

        <p className={styles.cue}>Bend the front knee to 90 degrees</p>
      </div>
    </div>
  );
}
