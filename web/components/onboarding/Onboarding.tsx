'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import { PoseFigure } from '@/components/PoseFigure';
import { getYogaPose } from '@/lib/data/poses';
import { generatePlans } from '@/lib/plans/generate';
import { completeOnboarding } from '@/lib/plans/actions';
import type {
  Experience,
  Goal,
  Minutes,
  OnboardingAnswers,
  PlanCandidate,
} from '@/lib/plans/types';
import styles from './Onboarding.module.css';

interface Choice<T> {
  value: T;
  label: string;
  detail: string;
}

const GOALS: Choice<Goal>[] = [
  { value: 'balance', label: 'Balance and focus', detail: 'Standing poses, held steady.' },
  { value: 'strength', label: 'Strength and stamina', detail: 'The poses your legs feel tomorrow.' },
  { value: 'calm', label: 'Calm and mobility', detail: 'Slower, opening shapes.' },
];

const EXPERIENCES: Choice<Experience>[] = [
  { value: 'new', label: 'New to this', detail: 'We will keep to the foundations.' },
  { value: 'some', label: 'Done a bit', detail: 'Comfortable with the basics.' },
  { value: 'regular', label: 'I practise regularly', detail: 'Full holds, harder poses.' },
];

const MINUTES: Choice<Minutes>[] = [
  { value: 5, label: '5 minutes', detail: 'Before the day starts.' },
  { value: 10, label: '10 minutes', detail: 'A real practice.' },
  { value: 20, label: '20 minutes', detail: 'Room for the whole thing.' },
];

const FLOOR: Choice<boolean>[] = [
  { value: true, label: 'Yes, I have space', detail: 'Unlocks Downward Dog and Cobra.' },
  { value: false, label: 'Standing only', detail: 'Everything stays on your feet.' },
];

type StepKey = 'goal' | 'experience' | 'minutes' | 'floor' | 'plans';
const ORDER: StepKey[] = ['goal', 'experience', 'minutes', 'floor', 'plans'];

const QUESTIONS: Record<Exclude<StepKey, 'plans'>, { title: string; hint: string }> = {
  goal: { title: 'What are you after?', hint: 'This decides which poses do the work.' },
  experience: { title: 'How much yoga have you done?', hint: 'This sets how long each hold runs.' },
  minutes: { title: 'How long do you have?', hint: 'We will build to fit, not overrun.' },
  floor: {
    title: 'Can you get down to the floor?',
    hint: 'Floor poses need a side-on camera at floor height, so they are optional.',
  },
};

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes <= 1 ? 'about a minute' : `about ${minutes} minutes`;
}

export function Onboarding({ displayName }: { displayName: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<StepKey>('goal');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [goal, setGoal] = useState<Goal | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [minutes, setMinutes] = useState<Minutes | null>(null);
  const [floorOk, setFloorOk] = useState<boolean | null>(null);

  const answers: OnboardingAnswers | null =
    goal && experience && minutes !== null && floorOk !== null
      ? { goal, experience, minutes, floorOk }
      : null;

  // Generated in the browser so the options appear the instant the last
  // question is answered. The server regenerates from the same answers when
  // one is chosen, so this is a preview of a decision made authoritatively
  // elsewhere rather than the decision itself.
  const candidates = useMemo(
    () => (answers ? generatePlans(answers) : []),
    [answers]
  );

  const advance = (from: StepKey) => {
    const next = ORDER[ORDER.indexOf(from) + 1];
    if (next) setStep(next);
  };

  const back = () => {
    const previous = ORDER[ORDER.indexOf(step) - 1];
    if (previous) setStep(previous);
  };

  const choose = (candidate: PlanCandidate) => {
    if (!answers) return;
    setError(null);
    startTransition(async () => {
      const result = await completeOnboarding(answers, candidate.shape);
      if (result.ok) router.push('/home');
      else setError(result.message ?? 'Something went wrong saving that plan.');
    });
  };

  const stepIndex = ORDER.indexOf(step);

  return (
    <div className={styles.wrap}>
      <div className={styles.progress} aria-hidden="true">
        {ORDER.map((key, index) => (
          <span
            key={key}
            className={styles.tick}
            data-state={index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'todo'}
          />
        ))}
      </div>

      {stepIndex > 0 && (
        <button type="button" onClick={back} className={styles.back}>
          <ArrowLeft size={15} strokeWidth={2.75} />
          Back
        </button>
      )}

      {step === 'goal' && (
        <Question
          title={displayName ? `Let’s build your plan, ${displayName}.` : QUESTIONS.goal.title}
          hint={displayName ? QUESTIONS.goal.hint : QUESTIONS.goal.hint}
          choices={GOALS}
          selected={goal}
          onSelect={(value) => {
            setGoal(value);
            advance('goal');
          }}
        />
      )}

      {step === 'experience' && (
        <Question
          {...QUESTIONS.experience}
          choices={EXPERIENCES}
          selected={experience}
          onSelect={(value) => {
            setExperience(value);
            advance('experience');
          }}
        />
      )}

      {step === 'minutes' && (
        <Question
          {...QUESTIONS.minutes}
          choices={MINUTES}
          selected={minutes}
          onSelect={(value) => {
            setMinutes(value);
            advance('minutes');
          }}
        />
      )}

      {step === 'floor' && (
        <Question
          {...QUESTIONS.floor}
          choices={FLOOR}
          selected={floorOk}
          onSelect={(value) => {
            setFloorOk(value);
            advance('floor');
          }}
        />
      )}

      {step === 'plans' && (
        <section>
          <h1 className={styles.title}>
            {candidates.length === 2 ? 'Two ways to start.' : 'Three ways to start.'}
          </h1>
          <p className={styles.hint}>
            Pick one. You can change it whenever you like — nothing here is locked in.
          </p>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <ul className={styles.plans}>
            {candidates.map((candidate) => (
              <li key={candidate.shape}>
                <article className={styles.plan}>
                  <header className={styles.planHead}>
                    <div>
                      <h2 className={styles.planName}>{candidate.name}</h2>
                      <p className={styles.planDesc}>{candidate.description}</p>
                    </div>
                    <span className="tag tag-neutral">
                      {formatDuration(candidate.durationSeconds)}
                    </span>
                  </header>

                  <ol className={styles.poses}>
                    {candidate.steps.map((step, index) => {
                      const pose = getYogaPose(step.poseId);
                      if (!pose) return null;
                      return (
                        <li key={`${step.poseId}-${index}`} className={styles.pose}>
                          <span className={styles.poseFigure}>
                            <PoseFigure poseId={pose.id} ground={false} />
                          </span>
                          <span className={styles.poseName}>{pose.short}</span>
                          <span className={styles.poseHold}>{step.holdSeconds}s</span>
                        </li>
                      );
                    })}
                  </ol>

                  {/*
                    The rationale is the point of generating plans rather than
                    listing them: it says why this one looks the way it does,
                    in terms of the answers just given.
                  */}
                  <p className={styles.rationale}>{candidate.rationale}</p>

                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    onClick={() => choose(candidate)}
                    disabled={pending}
                  >
                    {pending ? 'Saving…' : (
                      <>
                        <Check size={16} strokeWidth={2.75} />
                        Make this my plan
                      </>
                    )}
                  </button>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Question<T extends string | number | boolean>({
  title,
  hint,
  choices,
  selected,
  onSelect,
}: {
  title: string;
  hint: string;
  choices: Choice<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
}) {
  return (
    <section>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.hint}>{hint}</p>
      <ul className={styles.choices}>
        {choices.map((choice) => (
          <li key={String(choice.value)}>
            <button
              type="button"
              className={styles.choice}
              data-selected={selected === choice.value}
              onClick={() => onSelect(choice.value)}
            >
              <span className={styles.choiceLabel}>{choice.label}</span>
              <span className={styles.choiceDetail}>{choice.detail}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
