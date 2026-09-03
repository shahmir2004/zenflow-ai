import Link from 'next/link';
import { PoseFigure } from '@/components/PoseFigure';
import { YOGA_POSES } from '@/lib/data/poses';
import styles from './PoseLibrary.module.css';

/**
 * Every card is a link into a single-pose session with that pose selected and
 * its detail sheet open — the library is the picker, not a brochure of it.
 */
export function PoseLibrary() {
  return (
    <section className={`container ${styles.section}`} id="poses">
      <div className={styles.header}>
        <div>
          <h6 className={styles.kicker}>The library</h6>
          <h2 className={styles.title}>
            Eight poses, each with its own hold and its own cues.
          </h2>
        </div>
        <Link href="/session" className={`btn btn-ghost ${styles.openPicker}`}>
          Open the picker →
        </Link>
      </div>

      <ul className={styles.grid}>
        {YOGA_POSES.map((pose) => (
          <li key={pose.id}>
            <Link
              href={`/session?pose=${pose.id}&sheet=1`}
              className={styles.card}
            >
              <span className={styles.plate}>
                <PoseFigure poseId={pose.id} label={`${pose.name} figure`} />
              </span>

              <span className={styles.name}>{pose.name}</span>
              <span className={styles.sanskrit}>{pose.sanskrit}</span>

              <span className={styles.chips}>
                <span className="tag tag-accent-2">
                  {pose.cameraView === 'side' ? 'Side camera' : 'Front camera'}
                </span>
                <span className="tag tag-neutral">
                  {pose.holdTargetSeconds}s hold
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
