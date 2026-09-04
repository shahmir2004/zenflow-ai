import styles from './Faq.module.css';

/**
 * Native <details> rather than a JS accordion: it is keyboard- and
 * screen-reader-correct for free, works before hydration, and is findable by
 * the browser's own in-page search.
 */
const QUESTIONS = [
  {
    q: 'Does my video get uploaded anywhere?',
    a: 'No. Pose estimation runs in your browser and only the anonymous joint coordinates are sent for evaluation — never the image, and no video is ever recorded. If you make an account, we save what you held and what the coach flagged, so you can watch it improve. You can delete all of it at any time.',
  },
  {
    q: 'What if I can’t see the screen from my mat?',
    a: 'That’s the point. The coach speaks every correction, chimes when your pose locks, and paces your breath, so the screen is optional once you’re set up.',
  },
  {
    q: 'Which poses does it check?',
    a: 'Eight, each with its own hold target and cues: Mountain, Tree, Warrior I, Warrior II, Chair, Triangle, Downward Dog and Cobra. Standing poses want a front-facing camera; Downward Dog and Cobra want a side view.',
  },
  {
    q: 'Do I need a mat, a wearable, or a subscription?',
    a: 'A mat helps. No wearable, no depth camera, no account for your first flow.',
  },
  {
    q: 'It says my hips are lifting but they aren’t — what now?',
    a: 'Floor poses are read from a side view and are the hardest for any camera. Turn side-on to the lens, make sure your ankles are in frame, and the confidence badge will settle.',
  },
];

export function Faq() {
  return (
    <section className={`container ${styles.section}`} id="faq">
      <div>
        <h6 className={styles.kicker}>Questions</h6>
        <h2 className={styles.title}>Before your first hold.</h2>
      </div>

      <div className={styles.list}>
        {QUESTIONS.map((item) => (
          <details key={item.q} className={styles.row}>
            <summary className={styles.summary}>
              <span className={styles.question}>{item.q}</span>
              <span className={styles.badge} aria-hidden="true" />
            </summary>
            <p className={styles.answer}>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
