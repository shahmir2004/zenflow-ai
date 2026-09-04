'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { PoseFigure } from '@/components/PoseFigure';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { YOGA_POSES, type YogaPose } from '@/lib/data/poses';
import styles from './PoseSheet.module.css';

interface PoseSheetProps {
  pose: YogaPose | null;
  open: boolean;
  onClose: () => void;
  onHoldThisPose: () => void;
  /**
   * Pose switching, in single-pose mode only. It lives here rather than in the
   * control bar because eight chips is too much to carry mid-pose, and because
   * this is the one surface with room to show what each pose actually is.
   */
  showPicker?: boolean;
  onSelectPose?: (poseId: string) => void;
}

export function PoseSheet({
  pose,
  open,
  onClose,
  onHoldThisPose,
  showPicker = false,
  onSelectPose,
}: PoseSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isBottomSheet = useMediaQuery('(max-width: 700px)');

  // Escape closes, and focus moves into the panel so a keyboard user is not
  // left tabbing through the controls behind the scrim.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && pose && (
        <>
          <motion.div
            className={styles.scrim}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          />

          <motion.div
            ref={panelRef}
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label={`${pose.name} details`}
            tabIndex={-1}
            // The panel is a right-hand drawer on a wide screen and a bottom
            // sheet on a phone, so it has to enter along a different axis.
            initial={isBottomSheet ? { y: '104%' } : { x: '104%' }}
            animate={isBottomSheet ? { y: 0 } : { x: 0 }}
            exit={isBottomSheet ? { y: '104%' } : { x: '104%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <button type="button" className={styles.close} onClick={onClose}>
              <X size={18} strokeWidth={2.75} />
              <span className="sr-only">Close pose details</span>
            </button>

            <span className="tag tag-accent-2">
              {pose.cameraView === 'side' ? 'Side camera' : 'Front camera'}
            </span>

            <h3 className={styles.name}>{pose.name}</h3>
            <p className={styles.sanskrit}>{pose.sanskrit}</p>

            <div className={styles.plate}>
              <PoseFigure poseId={pose.id} label={`${pose.name} reference figure`} />
            </div>

            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={`mono ${styles.statLabel}`}>Hold target</span>
                <span className={styles.statValue}>{pose.holdTargetSeconds}s</span>
              </div>
              <div className={styles.stat}>
                <span className={`mono ${styles.statLabel}`}>Camera</span>
                <span className={styles.statValue}>
                  {pose.cameraView === 'side' ? 'Side' : 'Front'}
                </span>
              </div>
            </div>

            <p className={styles.description}>{pose.description}</p>

            <h6 className={styles.cuesHeading}>What the coach listens for</h6>
            <ul className={styles.cues}>
              {pose.cues.map((cue) => (
                <li key={cue}>{cue}</li>
              ))}
            </ul>

            {showPicker && onSelectPose && (
              <>
                <h6 className={styles.cuesHeading}>Hold a different pose</h6>
                <ul className={styles.picker}>
                  {YOGA_POSES.map((option) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        className={styles.pickerItem}
                        data-active={option.id === pose.id}
                        aria-pressed={option.id === pose.id}
                        onClick={() => onSelectPose(option.id)}
                      >
                        <span className={styles.pickerFigure}>
                          <PoseFigure poseId={option.id} ground={false} />
                        </span>
                        <span className={styles.pickerName}>{option.short}</span>
                        <span className={styles.pickerHold}>{option.holdTargetSeconds}s</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {pose.cameraView === 'side' && (
              <p className={styles.sideNote}>
                Floor poses are read from a side view and are the hardest for any
                camera. Place your phone at floor level, side-on, about two metres away.
              </p>
            )}

            <button
              type="button"
              className={`btn btn-primary ${styles.hold}`}
              onClick={onHoldThisPose}
            >
              Hold this pose
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
