/**
 * The frozen-marker diagnosis (api-doc/geo-tracker/tracking-sessions.md).
 *
 * Two readings carry every bug this file exists to catch, and both are cases
 * where the *absence* of a signal is meaningful:
 *
 *  · an absent device flag is "the phone never said", not "off";
 *  · `trackingAllow: false` is the server's `trackingEnabled === true && …`
 *    formula collapsing for an agent it has never heard from, not a refusal.
 *
 * Get either backwards and the dashboard tells an operator, in a full sentence
 * and with total confidence, that an agent switched their location off — when
 * the truth is that their phone has not checked in yet.
 */
import { describe, it, expect } from 'vitest';
import { connectionDrops, isActionableCause, resolveStallCauses } from './stall-cause';
import type {
  TrackingContext,
  TrackingDeviceState,
  TrackingEligibility,
  TrackingSessionSnapshot,
} from '@/types/tracking.types';

const AGENT = 'agent-1';

/** A healthy, reporting agent — the baseline each case bends one field of. */
function context(overrides: Partial<TrackingContext> = {}): TrackingContext {
  return {
    agentId: AGENT,
    connected: true,
    device: {
      locationEnabled: true,
      locationPermissionGranted: true,
      trackingEnabled: true,
      lastSeenAt: '2026-09-13T09:41:02Z',
    },
    trackingAllow: true,
    lastHeartbeatAt: '2026-09-13T09:41:00Z',
    activeShipment: true,
    sessions: [],
    ...overrides,
  };
}

/** A device that has never reported anything: every flag absent. */
const SILENT_DEVICE: TrackingDeviceState = {};

function eligibility(overrides: Partial<TrackingEligibility> = {}): TrackingEligibility {
  return { agentId: AGENT, eligible: true, reasons: [], ...overrides };
}

function session(overrides: Partial<TrackingSessionSnapshot> = {}): TrackingSessionSnapshot {
  return {
    sessionId: 'sess-1',
    shipmentId: 'ship-1',
    state: 'online',
    tracking: true,
    connectionCount: 1,
    startedAt: '2026-09-13T09:30:00Z',
    ...overrides,
  };
}

describe('resolveStallCauses — the explicit negatives', () => {
  it("reads a phone with location switched off", () => {
    expect(resolveStallCauses({ context: context({ device: { locationEnabled: false } }) })).toEqual(
      ['location_disabled'],
    );
  });

  it('reads a denied app permission separately from the OS toggle', () => {
    // Two different screens on the phone. Collapsing them sends the agent to
    // the wrong one.
    expect(
      resolveStallCauses({
        context: context({ device: { locationEnabled: true, locationPermissionGranted: false } }),
      }),
    ).toEqual(['location_permission_denied']);
  });

  it('reads sharing switched off in the app', () => {
    expect(
      resolveStallCauses({
        context: context({
          device: { locationEnabled: true, locationPermissionGranted: true, trackingEnabled: false },
          trackingAllow: false,
        }),
      }),
    ).toEqual(['tracking_disabled']);
  });

  it('reports EVERY failing rule at once, never just the first', () => {
    // The endpoint lists all of them for a reason: told only the first, the
    // agent fixes half of it and calls back.
    expect(
      resolveStallCauses({
        eligibility: eligibility({
          eligible: false,
          reasons: ['location_disabled', 'location_permission_denied', 'tracking_disabled'],
        }),
      }),
    ).toEqual(['location_disabled', 'location_permission_denied', 'tracking_disabled']);
  });

  it('unions the two sources, so one failed call still explains the freeze', () => {
    // Either call can 502 on its own (the cookie-only auth trap). One answer
    // beats none, and they cannot disagree — both derive from one device state.
    const causes = resolveStallCauses({
      context: context({ device: { locationEnabled: false, locationPermissionGranted: true } }),
      eligibility: eligibility({ eligible: false, reasons: ['location_disabled'] }),
    });
    expect(causes).toEqual(['location_disabled']);
  });
});

describe('resolveStallCauses — absence is not a negative', () => {
  it('calls a device that has never reported "nothing reported", not "everything off"', () => {
    // The trap: `!device.locationEnabled` is true for an absent flag, and would
    // accuse this agent of having switched three things off.
    expect(
      resolveStallCauses({
        context: context({
          device: SILENT_DEVICE,
          trackingAllow: false,
          lastHeartbeatAt: undefined,
        }),
        eligibility: eligibility(),
      }),
    ).toEqual(['nothing_reported']);
  });

  it('does not read `eligible: true` with no reasons as a clean bill of health', () => {
    // An unknown device state is eligible with no reasons. Rendering that as
    // "fine" leaves the operator staring at a frozen marker and a green light.
    const causes = resolveStallCauses({
      context: context({ device: SILENT_DEVICE, trackingAllow: false, lastHeartbeatAt: undefined }),
      eligibility: eligibility({ eligible: true, reasons: [] }),
    });
    expect(causes).not.toContain('reporting');
    expect(causes).toEqual(['nothing_reported']);
  });

  it('prefers "nothing reported" over the trackingAllow and connected readings it implies', () => {
    // A never-seen agent is trivially not-allowed and not-connected. Saying all
    // three is three accusations about a phone nobody has heard from.
    expect(
      resolveStallCauses({
        context: context({
          device: SILENT_DEVICE,
          trackingAllow: false,
          connected: false,
          lastHeartbeatAt: undefined,
        }),
      }),
    ).toEqual(['nothing_reported']);
  });

  it('does not say "nothing reported" about an agent whose fixes are landing', () => {
    // No device report, but heartbeats: the phone has plainly been talking.
    expect(
      resolveStallCauses({
        context: context({ device: SILENT_DEVICE, lastHeartbeatAt: '2026-09-13T09:41:00Z' }),
      }),
    ).toEqual(['reporting']);
  });
});

describe('resolveStallCauses — trackingAllow', () => {
  it('states the missing opt-in once the device is known to have reported', () => {
    // Reported (lastSeenAt), location fine, in-app switch never mentioned →
    // the server's formula yields false, and here that IS the answer.
    expect(
      resolveStallCauses({
        context: context({
          device: { locationEnabled: true, lastSeenAt: '2026-09-13T09:41:02Z' },
          trackingAllow: false,
        }),
      }),
    ).toEqual(['tracking_not_allowed']);
  });

  it('does not add it on top of a sharper cause that already explains it', () => {
    // trackingAllow is false *because* location is off. Two sentences for one
    // fact reads as two problems.
    expect(
      resolveStallCauses({
        context: context({
          device: { locationEnabled: false, lastSeenAt: '2026-09-13T09:41:02Z' },
          trackingAllow: false,
        }),
      }),
    ).toEqual(['location_disabled']);
  });
});

describe('resolveStallCauses — connection and health', () => {
  it('reports a disconnected app', () => {
    expect(resolveStallCauses({ context: context({ connected: false }) })).toEqual(['disconnected']);
  });

  it('keeps the disconnection alongside a device fault rather than hiding one', () => {
    expect(
      resolveStallCauses({
        context: context({
          connected: false,
          device: { locationEnabled: false, lastSeenAt: '2026-09-13T09:41:02Z' },
          trackingAllow: false,
        }),
      }),
    ).toEqual(['location_disabled', 'disconnected']);
  });

  it('says plainly that nothing is wrong when nothing is', () => {
    expect(resolveStallCauses({ context: context(), eligibility: eligibility() })).toEqual([
      'reporting',
    ]);
  });
});

describe('resolveStallCauses — when it cannot tell', () => {
  it('invents nothing when both calls failed', () => {
    expect(resolveStallCauses({})).toEqual([]);
    expect(resolveStallCauses({ context: null, eligibility: null })).toEqual([]);
  });

  it('invents nothing from a healthy eligibility alone', () => {
    // Without the context there is no `lastSeenAt`, so "nothing reported yet"
    // cannot be established — and must not be guessed at.
    expect(resolveStallCauses({ eligibility: eligibility() })).toEqual([]);
  });
});

describe('isActionableCause', () => {
  it('separates "phone the agent" from "wait"', () => {
    expect(isActionableCause('location_disabled')).toBe(true);
    expect(isActionableCause('location_permission_denied')).toBe(true);
    expect(isActionableCause('tracking_disabled')).toBe(true);
    expect(isActionableCause('tracking_not_allowed')).toBe(true);
    expect(isActionableCause('disconnected')).toBe(false);
    expect(isActionableCause('nothing_reported')).toBe(false);
    expect(isActionableCause('reporting')).toBe(false);
  });
});

describe('connectionDrops', () => {
  it('counts drops, which is one fewer than connections', () => {
    // The documented reading: 3 is one delivery whose phone dropped twice.
    expect(connectionDrops(context({ sessions: [session({ connectionCount: 3 })] }))).toBe(2);
  });

  it('is zero for a session that has never dropped', () => {
    expect(connectionDrops(context({ sessions: [session({ connectionCount: 1 })] }))).toBe(0);
    expect(connectionDrops(context({ sessions: [] }))).toBe(0);
    expect(connectionDrops(null)).toBe(0);
  });

  it('takes the longest-running session, since they share one connection', () => {
    expect(
      connectionDrops(
        context({
          sessions: [
            session({ sessionId: 'late', connectionCount: 1 }),
            session({ sessionId: 'early', connectionCount: 4 }),
          ],
        }),
      ),
    ).toBe(3);
  });

  it('never goes negative on a count of zero', () => {
    expect(connectionDrops(context({ sessions: [session({ connectionCount: 0 })] }))).toBe(0);
  });
});
