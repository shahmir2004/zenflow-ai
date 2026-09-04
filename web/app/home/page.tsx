import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Play, Flame, Clock, TrendingDown } from 'lucide-react';
import { getUser } from '@/lib/supabase/server';
import {
  getActivePlan,
  getProfile,
  getRecentSessions,
  getStreak,
} from '@/lib/sessions/queries';
import { getYogaPose } from '@/lib/data/poses';
import { PoseFigure } from '@/components/PoseFigure';
import { ClaimGuestSessions } from '@/components/auth/ClaimGuestSessions';
import { AppNav } from '@/components/layout/AppNav';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Practice — ZenFlow AI',
};

function formatMinutes(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  if (minutes === 0) return `${remainder}s`;
  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
}

function relativeDay(iso: string): string {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default async function HomePage() {
  const user = await getUser();
  if (!user) redirect('/sign-in?next=/home');

  const [profile, plan, sessions, streak] = await Promise.all([
    getProfile(),
    getActivePlan(),
    getRecentSessions(5),
    getStreak(),
  ]);

  // Onboarding is where a plan comes from, so someone who has not done it has
  // nothing to practise here.
  if (profile && !profile.onboarding_completed_at) redirect('/onboarding');

  const firstName = profile?.display_name?.split(' ')[0] ?? null;
  const lastSession = sessions[0];
  const planDuration =
    plan?.steps.reduce((total, step) => total + step.hold_seconds + step.rest_seconds, 0) ?? 0;

  return (
    <>
      <AppNav />
      <main className={`container ${styles.page}`}>
        <ClaimGuestSessions />

        <header className={styles.head}>
          <h1 className={styles.greeting}>
            {firstName ? `Ready when you are, ${firstName}.` : 'Ready when you are.'}
          </h1>
        </header>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <Flame size={17} strokeWidth={2.75} aria-hidden="true" />
            <span className={styles.statValue}>{streak.current}</span>
            <span className={styles.statLabel}>
              day{streak.current === 1 ? '' : 's'} in a row
            </span>
          </div>
          <div className={styles.stat}>
            <Clock size={17} strokeWidth={2.75} aria-hidden="true" />
            <span className={styles.statValue}>{sessions.length}</span>
            <span className={styles.statLabel}>recent sessions</span>
          </div>
          <div className={styles.stat}>
            <TrendingDown size={17} strokeWidth={2.75} aria-hidden="true" />
            <span className={styles.statValue}>{streak.longest}</span>
            <span className={styles.statLabel}>longest run</span>
          </div>
        </div>

        {plan ? (
          <section className={styles.planCard}>
            <div className={styles.planHead}>
              <div>
                <h6 className={styles.kicker}>Your plan</h6>
                <h2 className={styles.planName}>{plan.name}</h2>
              </div>
              <span className="tag tag-neutral">
                about {Math.max(1, Math.round(planDuration / 60))} min
              </span>
            </div>

            <ol className={styles.poses}>
              {plan.steps.map((step, index) => {
                const pose = getYogaPose(step.pose_id);
                if (!pose) return null;
                return (
                  <li key={`${step.pose_id}-${index}`} className={styles.pose}>
                    <span className={styles.poseFigure}>
                      <PoseFigure poseId={pose.id} ground={false} />
                    </span>
                    <span className={styles.poseName}>{pose.short}</span>
                    <span className={styles.poseHold}>{step.hold_seconds}s</span>
                  </li>
                );
              })}
            </ol>

            {plan.rationale && <p className={styles.rationale}>{plan.rationale}</p>}

            <div className={styles.planActions}>
              <Link href={`/session?plan=${plan.id}`} className="btn btn-primary">
                <Play size={16} strokeWidth={2.75} />
                Start your plan
              </Link>
              <Link href="/onboarding" className="btn btn-ghost">
                Change plan
              </Link>
            </div>
          </section>
        ) : (
          <section className={styles.empty}>
            <h2 className={styles.emptyTitle}>No plan yet.</h2>
            <p className={styles.emptyBody}>
              Four questions and we will build one around what you are after,
              how long you have, and whether the floor is an option.
            </p>
            <Link href="/onboarding" className="btn btn-primary">
              Build my plan
            </Link>
          </section>
        )}

        <section className={styles.recent}>
          <div className={styles.recentHead}>
            <h6 className={styles.kicker}>Recent practice</h6>
            {sessions.length > 0 && (
              <Link href="/progress" className="btn btn-ghost">
                See your progress →
              </Link>
            )}
          </div>

          {lastSession ? (
            <ul className={styles.sessionList}>
              {sessions.map((session) => (
                <li key={session.id} className={styles.sessionRow}>
                  <span className={styles.sessionWhen}>{relativeDay(session.ended_at)}</span>
                  <span className={styles.sessionHeld}>
                    {formatMinutes(session.total_held_seconds)} held
                  </span>
                  <span className={styles.sessionPoses}>
                    {session.poses_to_target}/{session.total_poses} to target
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyBody}>
              Nothing here yet. Your first session will show up the moment you
              finish one.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
