import { useEffect, useMemo, useRef, useState } from 'react';
import { geoTrackerService, warnGeoTrackerDegraded } from '@/services/geo-tracker.service';
import {
  connectionDrops,
  resolveStallCauses,
  type TrackingStallCause,
} from '@/components/tracking/stall-cause';
import type { TrackingContext, TrackingEligibility } from '@/types/tracking.types';

/**
 * Ask geo-tracker why one agent's position stopped arriving — lazily, once, and
 * only for the agent whose card is open.
 *
 * ## Why it is not simply fetched with the board
 *
 * The board is fifteen agents on a good day, and this costs two requests per
 * agent. Fetching it for the roster would double-digit the page's traffic on
 * every refresh to produce fourteen answers nobody asked for and one the
 * operator wanted — and it would do it again every sixty seconds, because the
 * board polls. So the trigger is the narrowest one that still answers the
 * question when it is actually being asked:
 *
 *  · **stalled** — no live fix and no `permission_revoked`. An agent who is
 *    reporting has nothing to explain, so a healthy board issues no requests at
 *    all; a revoked one already has its answer, and a better one.
 *  · **expanded** — the explanation is rendered inside the open card, so
 *    fetching it for a collapsed row buys a sentence nobody can read.
 *
 * Both must hold, and the result is then kept: collapsing and reopening the same
 * card re-reads what is already held, and the sixty-second board poll does not
 * disturb it. There is deliberately **no polling and no refresh control** — the
 * held answer is retired only when the agent starts reporting again, so the next
 * stall is diagnosed afresh rather than explained by a reading from twenty
 * minutes ago.
 */
export type StallDiagnosisState =
  /** Not asked — the agent is reporting, or their card is closed. */
  | 'idle'
  /** Asked; waiting. */
  | 'loading'
  /** At least one of the two reads answered. */
  | 'ready'
  /** Both reads failed. We know nothing, and the card says exactly that. */
  | 'unavailable';

export interface StallDiagnosis {
  /** Every cause that could be stated, most actionable first. Empty when none could. */
  causes: TrackingStallCause[];
  /** Times the agent's connection has dropped during this delivery, or `0`. */
  drops: number;
  state: StallDiagnosisState;
}

interface Answers {
  context: TrackingContext | null;
  eligibility: TrackingEligibility | null;
}

export function useStallDiagnosis(
  agentId: string,
  { stalled, expanded }: { stalled: boolean; expanded: boolean },
): StallDiagnosis {
  /** What the two reads answered, tagged with the stall they answered about. */
  const [held, setHeld] = useState<{ key: string; answers: Answers } | null>(null);
  /** Which stall this is. A new one retires the previous one's answers. */
  const [episode, setEpisode] = useState(0);
  const [prevStalled, setPrevStalled] = useState(stalled);
  /** The stall this hook has already spent its one pair of requests on. */
  const askedFor = useRef<string | null>(null);

  // Adjusting state during render — the React-recommended alternative to a
  // setState-in-effect, and the same pattern LiveTracking uses for its deep
  // link. A fix landing (or a revocation arriving) ends this stall; the next
  // one is a different question and deserves a fresh answer.
  if (prevStalled !== stalled) {
    setPrevStalled(stalled);
    if (!stalled) setEpisode((n) => n + 1);
  }

  const key = `${agentId}#${episode}`;
  // Answers from a previous stall are not answers about this one.
  const answers = held?.key === key ? held.answers : null;
  // Derived rather than flagged: a "loading" that is set synchronously inside
  // the effect that starts the request is a cascading render for a value the
  // render already knows.
  const asking = stalled && expanded && !answers;

  useEffect(() => {
    if (!stalled || !expanded) return;
    if (askedFor.current === key) return;
    askedFor.current = key;

    let cancelled = false;

    void (async () => {
      // Caught per call rather than around `Promise.all`: on the web build
      // either route can answer 502 on its own (geo-tracker reads the forwarded
      // token from the Authorization header only, and a browser cannot send the
      // httpOnly cookie as one — see getCheckpoints). One answer still explains
      // most freezes, so one failure must not discard the other.
      const [context, eligibility] = await Promise.all([
        geoTrackerService.getSession(agentId).catch((err: unknown) => {
          warnGeoTrackerDegraded('tracking context', err);
          return null;
        }),
        geoTrackerService.getEligibility(agentId).catch((err: unknown) => {
          warnGeoTrackerDegraded('tracking eligibility', err);
          return null;
        }),
      ]);
      if (cancelled) return;
      // Held even when both are null: "we asked and could not find out" is a
      // state the card has a sentence for, and is not the same as not asking.
      setHeld({ key, answers: { context, eligibility } });
    })();

    return () => {
      cancelled = true;
    };
  }, [agentId, key, stalled, expanded]);

  return useMemo(() => {
    const state: StallDiagnosisState = answers
      ? answers.context || answers.eligibility
        ? 'ready'
        : 'unavailable'
      : asking
        ? 'loading'
        : 'idle';
    if (!answers) return { causes: [], drops: 0, state };
    return {
      causes: resolveStallCauses(answers),
      drops: connectionDrops(answers.context),
      state,
    };
  }, [answers, asking]);
}
