'use client';

import styles from './BreathPacer.module.css';

/**
 * The 4·4·8 breath pacer.
 *
 * Rendered only while the pose is valid. Pacing someone's breath while also
 * telling them their knee is wrong asks for two things at once, and the breath
 * is the one that should wait — so the caller unmounts this whenever there is
 * an active correction.
 */
export function BreathPacer() {
  return (
    <div className={`${styles.pacer} zf-fade-up`} aria-hidden="true">
      <div className={styles.labels}>
        <span className="zf-phase-inhale">Inhale · 4</span>
        <span className="zf-phase-hold">Hold · 4</span>
        <span className="zf-phase-exhale">Exhale · 8</span>
      </div>
    </div>
  );
}
