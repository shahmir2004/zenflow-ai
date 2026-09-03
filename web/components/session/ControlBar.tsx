'use client';

import { useEffect, useRef } from 'react';
import { Info, Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import { YOGA_POSES, type YogaPose } from '@/lib/data/poses';
import type { ResolvedStep } from '@/lib/data/flowEngine';
import { getYogaPose } from '@/lib/data/poses';
import styles from './ControlBar.module.css';

export type SessionMode = 'single' | 'flow';

interface ControlBarProps {
  mode: SessionMode;
  onModeChange: (mode: SessionMode) => void;
  currentPose: YogaPose | null;
  onSelectPose: (poseId: string) => void;
  steps: ResolvedStep[];
  stepIndex: number;
  nextPose: YogaPose | null;
  voiceOn: boolean;
  onVoiceChange: (on: boolean) => void;
  voiceSupported: boolean;
  focusSurface: boolean;
  onFocusSurfaceChange: (on: boolean) => void;
  onOpenDetails: () => void;
  onEndSession: () => void;
}

/** Lucide at the design system's weight. */
const ICON = { size: 18, strokeWidth: 2.75 } as const;

export function ControlBar({
  mode,
  onModeChange,
  currentPose,
  onSelectPose,
  steps,
  stepIndex,
  nextPose,
  voiceOn,
  onVoiceChange,
  voiceSupported,
  focusSurface,
  onFocusSurfaceChange,
  onOpenDetails,
  onEndSession,
}: ControlBarProps) {
  const activeChipRef = useRef<HTMLButtonElement>(null);

  // The chip row scrolls horizontally on a phone, and selecting Cobra would
  // otherwise leave the active pose off-screen with no sign anything moved.
  //
  // Scrolling the row directly rather than with scrollIntoView: that method
  // walks up and scrolls every scrollable ancestor, and the session is a
  // fixed, overflow-hidden surface that must not move.
  useEffect(() => {
    const chip = activeChipRef.current;
    const row = chip?.parentElement;
    if (!chip || !row) return;

    // Measured from rects rather than offsetLeft: the row is not a positioned
    // element, so offsetLeft resolves against the control bar and includes the
    // mode segment's width.
    const chipBox = chip.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    row.scrollTo({
      left:
        row.scrollLeft +
        (chipBox.left - rowBox.left) -
        (rowBox.width - chipBox.width) / 2,
      behavior: 'smooth',
    });
  }, [currentPose?.id, mode]);

  return (
    <div className={styles.bar}>
      <div className={styles.segment} role="group" aria-label="Session type">
        <button
          type="button"
          className={styles.segmentOption}
          data-active={mode === 'single'}
          aria-pressed={mode === 'single'}
          onClick={() => onModeChange('single')}
        >
          Single pose
        </button>
        <button
          type="button"
          className={styles.segmentOption}
          data-active={mode === 'flow'}
          aria-pressed={mode === 'flow'}
          onClick={() => onModeChange('flow')}
        >
          Guided flow
        </button>
      </div>

      {mode === 'single' ? (
        <div className={styles.chips} role="group" aria-label="Choose a pose">
          {YOGA_POSES.map((pose) => {
            const active = pose.id === currentPose?.id;
            return (
              <button
                key={pose.id}
                type="button"
                ref={active ? activeChipRef : undefined}
                className={styles.chip}
                data-active={active}
                aria-pressed={active}
                onClick={() => onSelectPose(pose.id)}
              >
                {pose.short}
              </button>
            );
          })}
        </div>
      ) : (
        <div className={styles.flow}>
          <div className={styles.track} role="group" aria-label="Flow progress">
            {steps.map((step, index) => {
              const pose = getYogaPose(step.poseId);
              const state =
                index === stepIndex ? 'current' : index < stepIndex ? 'done' : 'upcoming';
              return (
                <span
                  key={`${step.poseId}-${index}`}
                  className={styles.dash}
                  data-state={state}
                  title={pose?.name}
                />
              );
            })}
          </div>
          <span className={styles.nextUp}>
            {nextPose ? `Next · ${nextPose.short}` : 'Last pose'}
          </span>
        </div>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.iconButton}
          data-on={voiceOn}
          onClick={() => onVoiceChange(!voiceOn)}
          disabled={!voiceSupported}
          aria-pressed={voiceOn}
          title={
            voiceSupported
              ? voiceOn
                ? 'Turn the voice coach off'
                : 'Turn the voice coach on'
              : 'This browser has no speech synthesis'
          }
        >
          {voiceOn ? <Volume2 {...ICON} /> : <VolumeX {...ICON} />}
          <span className="sr-only">
            {voiceOn ? 'Turn the voice coach off' : 'Turn the voice coach on'}
          </span>
        </button>

        <button
          type="button"
          className={styles.iconButton}
          onClick={() => onFocusSurfaceChange(!focusSurface)}
          aria-pressed={focusSurface}
          title={focusSurface ? 'Switch to the light surface' : 'Switch to the focus surface'}
        >
          {focusSurface ? <Sun {...ICON} /> : <Moon {...ICON} />}
          <span className="sr-only">
            {focusSurface ? 'Switch to the light surface' : 'Switch to the focus surface'}
          </span>
        </button>

        <button
          type="button"
          className={styles.iconButton}
          onClick={onOpenDetails}
          title="Pose details"
        >
          <Info {...ICON} />
          <span className="sr-only">Show pose details</span>
        </button>

        <button type="button" className={`btn btn-primary ${styles.end}`} onClick={onEndSession}>
          End session
        </button>
      </div>
    </div>
  );
}
