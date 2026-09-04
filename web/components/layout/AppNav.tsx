import Link from 'next/link';
import { getUser } from '@/lib/supabase/server';
import { getProfile } from '@/lib/sessions/queries';
import styles from './AppNav.module.css';

/**
 * The nav for signed-in surfaces.
 *
 * Separate from the landing page's marketing nav: that one sells the product
 * to someone who has not tried it, this one gets someone who has already
 * decided to their practice in as few clicks as possible.
 */
export async function AppNav() {
  const user = await getUser();
  const profile = user ? await getProfile() : null;
  const initial = (profile?.display_name ?? user?.email ?? '?').charAt(0).toUpperCase();

  return (
    <header className={styles.nav}>
      <Link href="/home" className={styles.brand} aria-label="ZenFlow AI, practice home">
        <span className={styles.mark} aria-hidden="true">
          <span className={styles.markDot} />
        </span>
        <span className={styles.wordmark}>ZenFlow AI</span>
      </Link>

      <nav className={styles.links} aria-label="Practice">
        <Link href="/home" className={styles.link}>
          Practice
        </Link>
        <Link href="/progress" className={styles.link}>
          Progress
        </Link>
        <Link href="/account" className={styles.link}>
          Account
        </Link>
      </nav>

      <div className={styles.right}>
        <Link href="/session" className={`btn btn-primary ${styles.cta}`}>
          Start a session
        </Link>
        <Link href="/account" className={styles.avatar} aria-label="Your account">
          {initial}
        </Link>
      </div>
    </header>
  );
}
