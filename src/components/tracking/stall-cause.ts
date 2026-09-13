/**
 * Why is this agent's marker frozen?
 *
 * A board row with no position is the one state this dashboard used to answer
 * with a sentence that was true and useless — "Awaiting a position from this
 * agent." It is true of an agent whose phone is in a drawer, of one who never
 * granted the app location permission, of one riding through a tunnel, and of
 * one whose first fix is four seconds away. Those call for four different
 * reactions, and only one of them is "do nothing".
 *
 * This module turns geo-tracker's two read models into that distinction. It is
 * pure on purpose: the fetching, the caching and the copy all live elsewhere
 * (`useStallDiagnosis`, `TrackedAgentCard`), so the part that is easy to get
 * quietly wrong is the part that is directly testable.
 *
 * ⚠ It has nothing to do with `permission_revoked`. A revocation is an *answer*
 * the server volunteered, with its own three-way reading in
 * `tracking.types.ts`; this runs only when there is no revocation at all and
 * the silence is unexplained. Never let a cause resolved here overwrite one of
 * those three.
 */

import type {
  TrackingContext,
  TrackingDeviceState,
  TrackingEligibility,
} from '@/types/tracking.types';

/**
 * One statable reason a position is not arriving.
 *
 * Ordered here roughly by what the reader should do about it: the first three
 * are fixed on the agent's phone (so: call them), the middle two are states of
 * the world, and the last is "nothing is wrong".
 */
export type TrackingStallCause =
  /** The handset's OS location services are off. Nothing can produce a fix. */
  | 'location_disabled'
  /** The agent app was denied OS location permission — a different screen on the phone. */
  | 'location_permission_denied'
  /** The agent switched sharing off inside the app. */
  | 'tracking_disabled'
  /**
   * No Tracking Allow: the agent has not opted in, so the platform may not read
   * a position for them at all. Distinguished from the three above because
   * nothing was reported as explicitly *off* — see {@link resolveStallCauses}.
   */
  | 'tracking_not_allowed'
  /** The agent's app holds no connection right now — lost signal, or closed. */
  | 'disconnected'
  /**
   * The phone has told geo-tracker nothing whatsoever: no device state, no
   * heartbeat, ever. **Not** a fault, and emphatically not "everything is fine"
   * — it is the honest answer to why there is nothing to draw.
   */
  | 'nothing_reported'
  /** Connected, permitted and reporting. Nothing is wrong; the fix is simply not here yet. */
  | 'reporting';

export interface StallDiagnosisInput {
  /** GET /tracking/sessions/:agentId, or `null` when that call failed. */
  context?: TrackingContext | null;
  /** GET /tracking/sessions/:agentId/eligibility, or `null` when that call failed. */
  eligibility?: TrackingEligibility | null;
}

/** The i18n key each cause renders as, one sentence apiece. */
export const STALL_CAUSE_NOTE_KEY = {
  location_disabled: 'agent.causeLocationDisabled',
  location_permission_denied: 'agent.causeLocationPermissionDenied',
  tracking_disabled: 'agent.causeTrackingDisabled',
  tracking_not_allowed: 'agent.causeTrackingNotAllowed',
  disconnected: 'agent.causeDisconnected',
  nothing_reported: 'agent.causeNothingReported',
  reporting: 'agent.causeReporting',
} as const satisfies Record<TrackingStallCause, string>;

/**
 * Causes that a person has to go and fix — the ones that mean "phone the
 * agent". The rest are states to wait out, and rendering the two alike is how a
 * board full of amber sentences stops being read.
 */
const ACTIONABLE: ReadonlySet<TrackingStallCause> = new Set<TrackingStallCause>([
  'location_disabled',
  'location_permission_denied',
  'tracking_disabled',
  'tracking_not_allowed',
]);

export function isActionableCause(cause: TrackingStallCause): boolean {
  return ACTIONABLE.has(cause);
}

/** Has this device ever reported its own configuration? */
function hasReportedDevice(device: TrackingDeviceState): boolean {
  return (
    device.lastSeenAt !== undefined ||
    device.locationEnabled !== undefined ||
    device.locationPermissionGranted !== undefined ||
    device.trackingEnabled !== undefined
  );
}

/**
 * Resolve every cause that can be stated from what geo-tracker answered.
 *
 * **Every** one, not the first: a phone can have location services off *and*
 * the app's permission denied, and telling the operator only about the first
 * gets the agent to fix half of it and call back. The eligibility endpoint
 * reports all failing rules at once for exactly this reason, so this preserves
 * that rather than collapsing it.
 *
 * The two sources are unioned rather than one being preferred, because they can
 * arrive independently — either call can fail on its own (the cookie-only `502`
 * this service is prone to on the web build), and one answer still beats none.
 * They cannot disagree: eligibility is derived from the same device state the
 * context carries.
 *
 * Returns `[]` when nothing can be stated — both calls failed, or they came back
 * with nothing that explains the silence. The caller says so rather than
 * inventing a cause.
 *
 * ## The two readings that are easy to get backwards
 *
 * 1. **An absent device flag is not `false`.** It means the phone has never
 *    reported that signal. So the explicit negatives are tested with `=== false`
 *    and never with `!`, and a device that reported nothing falls through to
 *    `nothing_reported` instead of being accused of having everything switched
 *    off.
 * 2. **`trackingAllow: false` is not always a refusal.** The server computes it
 *    as `trackingEnabled === true && no explicit location negative`, so it is
 *    also `false` for every agent who has never reported anything. Claiming "this
 *    agent has not opted in" there would be a confident statement about a phone
 *    we have not heard from — hence it is only reached once the device is known
 *    to have reported, and only when no sharper cause already explains it.
 */
export function resolveStallCauses(input: StallDiagnosisInput): TrackingStallCause[] {
  const context = input.context ?? null;
  const eligibility = input.eligibility ?? null;
  if (!context && !eligibility) return [];

  const device = context?.device ?? {};
  const reasons = new Set(eligibility?.reasons ?? []);
  const causes: TrackingStallCause[] = [];

  // 1. The explicit negatives, from whichever of the two answers arrived.
  if (device.locationEnabled === false || reasons.has('location_disabled')) {
    causes.push('location_disabled');
  }
  if (device.locationPermissionGranted === false || reasons.has('location_permission_denied')) {
    causes.push('location_permission_denied');
  }
  if (device.trackingEnabled === false || reasons.has('tracking_disabled')) {
    causes.push('tracking_disabled');
  }

  if (causes.length === 0) {
    // 2. Nothing reported, ever — neither a device signal nor a single fix.
    //    This outranks `trackingAllow` and `connected`, both of which are
    //    trivially false for an agent geo-tracker has never heard from, and
    //    both of which would read as an accusation if rendered.
    if (!hasReportedDevice(device) && !context?.lastHeartbeatAt) {
      return context ? ['nothing_reported'] : [];
    }
    // 3. The device has spoken, and what it said adds up to no opt-in.
    if (context?.trackingAllow === false && hasReportedDevice(device)) {
      causes.push('tracking_not_allowed');
    }
  }

  // 4. The app is not connected. Additive rather than exclusive: a phone with
  //    location switched off that is *also* offline is two facts, and the
  //    device flags are last-known rather than current while it is away.
  if (context?.connected === false) causes.push('disconnected');

  // 5. Nothing is wrong — permitted, connected, reporting. Saying so plainly is
  //    the point of the whole exercise: it is the one case where the operator
  //    should do nothing.
  if (causes.length === 0 && context) causes.push('reporting');

  return causes;
}

/**
 * How many times this agent's connection has dropped during the delivery they
 * are on, or `0`.
 *
 * `connectionCount` counts connections *bound* to the session, so the drops are
 * one fewer — a session on its first connection has never dropped. The
 * difference between a one-off blip and a phone that keeps losing signal is
 * worth a line on the card; "3" rendered as a count of anything else is not.
 *
 * Several sessions share the agent's single connection but start at different
 * times, so the longest-running one carries the true count.
 */
export function connectionDrops(context: TrackingContext | null | undefined): number {
  if (!context) return 0;
  return (context.sessions ?? []).reduce(
    (most, session) => Math.max(most, Math.max(0, (session.connectionCount ?? 0) - 1)),
    0,
  );
}
