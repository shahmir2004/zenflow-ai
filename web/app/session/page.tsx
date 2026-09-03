import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LiveSession } from '@/components/session/LiveSession';
import { YOGA_POSE_BY_ID } from '@/lib/data/poses';
import { getYogaFlow } from '@/lib/data/flows';

export const metadata: Metadata = {
  title: 'Live session — ZenFlow AI',
  description:
    'Hold a pose and get spoken corrections in real time. Pose detection runs on your device.',
};

/**
 * Entry points into a session, all from the landing page:
 *   /session                       the default guided flow
 *   /session?pose=tree             one pose, held on its own
 *   /session?pose=tree&sheet=1     the same, with its details open
 *   /session?flow=morning-wakeup   a named flow
 */
interface PageProps {
  searchParams: Promise<{
    pose?: string;
    flow?: string;
    sheet?: string;
    preview?: string;
  }>;
}

export default async function SessionPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Validate against the catalog rather than trusting the URL: an unknown
  // label would leave the backend reporting `idle` with no way for the user
  // to tell that from "no pose selected".
  const poseId = params.pose && YOGA_POSE_BY_ID[params.pose] ? params.pose : undefined;
  const flowId = getYogaFlow(params.flow)?.id;

  return (
    <Suspense>
      <LiveSession
        initialPoseId={poseId}
        initialFlowId={flowId}
        initialMode={poseId && !flowId ? 'single' : 'flow'}
        openSheetOnLoad={params.sheet === '1' && Boolean(poseId)}
        preview={params.preview === '1'}
      />
    </Suspense>
  );
}
