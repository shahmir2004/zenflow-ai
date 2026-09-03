import Link from 'next/link';
import styles from './Nav.module.css';

const LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#poses', label: 'Poses' },
  { href: '#faq', label: 'FAQ' },
];

/**
 * The brand mark is a ring with a dot inside it — the same geometry as the
 * hold ring in the live session, so the logo is the product's core gesture
 * rather than a shape chosen to look like a logo.
 */
export function Nav() {
  return (
    <header className={styles.nav}>
      <Link href="/" className={styles.brand} aria-label="ZenFlow AI, home">
        <span className={styles.mark} aria-hidden="true">
          <span className={styles.markDot} />
        </span>
        <span className={styles.wordmark}>ZenFlow AI</span>
      </Link>

      <nav className={styles.links} aria-label="Sections">
        {LINKS.map((link) => (
          <a key={link.href} href={link.href} className={styles.link}>
            {link.label}
          </a>
        ))}
      </nav>

      <Link href="/session" className={`btn btn-primary ${styles.cta}`}>
        Start a session
      </Link>
    </header>
  );
}
