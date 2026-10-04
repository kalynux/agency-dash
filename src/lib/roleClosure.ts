// Leaving the app after the agency account was closed (ADR-A10).
//
// ─── Why this is a module and not a navigate() in the closure screen ──────────
//
// A confirmed closure clears the session cookies in the same response, and the
// dashboard is still mounted with half a dozen pollers on timers. Every one of
// them that fires before the shell unmounts comes back `401 AUTH_MISSING_TOKEN`
// or `403 AUTH_ROLE_CLOSED`, and each of those dispatches `auth:logout` — whose
// two listeners (App, OnboardingGuard) send the user to `/login`. That is right
// for `accountClosed: false` and wrong for `true`, where there is nothing to
// sign in to and the "account closed" screen must stay put.
//
// So the outcome is recorded here, once, and every sign-out route is decided by
// {@link signOutDestination}, which honours it. It lives in module scope on
// purpose: it must survive the dashboard unmounting, and it must NOT survive a
// reload — after one, `/account-closed` is a static page and `/login` is an
// ordinary sign-in.

import { stopRefreshScheduler } from '@/platform/auth/refreshScheduler';
import { authStrategy } from '@/platform/auth/strategy';
import { clearCachedPushToken } from '@/platform/push';
import { forgetBiometricSignIn } from '@/lib/biometricUnlock';
import type { RoleClosureOutcome } from '@/types/role-closure.types';

/** The public screen for a closed account. Outside every guard. */
export const ACCOUNT_CLOSED_PATH = '/account-closed';

/** The in-app closure screen — where `account/closure` deep links land. */
export const ACCOUNT_CLOSURE_PATH = '/dashboard/account/closure';

/**
 * The cause attached to the sign-in screen after this agency was closed, by its
 * owner here or on another device. Resolved through `errors:codes`, like every
 * other `signedOutBy`.
 */
export const ROLE_CLOSED_SIGN_OUT_CODE = 'AUTH_ROLE_CLOSED';

let closedOutcome: Pick<RoleClosureOutcome, 'accountClosed'> | null = null;

export interface SignOutDestination {
  to: string;
  state?: { signedOutBy: string };
}

/**
 * Where an `auth:logout` should land. Every listener asks this rather than
 * hard-coding `/login`, so a closure outcome wins over whatever code the last
 * stray poller happened to be refused with.
 */
export function signOutDestination(cause?: string): SignOutDestination {
  if (closedOutcome?.accountClosed) return { to: ACCOUNT_CLOSED_PATH };
  const code = closedOutcome ? ROLE_CLOSED_SIGN_OUT_CODE : cause;
  return { to: '/login', state: code ? { signedOutBy: code } : undefined };
}

/**
 * Drop everything this device holds for the closed agency, then tell the app.
 *
 * Deliberately NOT `authService.logout()`: that unregisters the push device
 * first, which is an authenticated call — against a role that no longer exists
 * it is refused, and the refusal would itself dispatch a second sign-out. The
 * local push cache is cleared instead; the server has nothing left to deliver
 * to a closed role.
 *
 * Never throws: the closure already happened server-side, and nothing here may
 * keep the user on a screen for an account that is gone.
 */
export async function endClosedRoleSession(outcome: RoleClosureOutcome): Promise<void> {
  closedOutcome = { accountClosed: outcome.accountClosed };
  stopRefreshScheduler();
  await Promise.allSettled([
    // A stored credential would sign straight back into a role that cannot be
    // signed in to, and on a closed account into nothing at all.
    forgetBiometricSignIn(),
    clearCachedPushToken(),
    // Cookie: `POST /auth/logout` (the confirm already cleared them; harmless).
    // Bearer: discard the pair.
    authStrategy.endSession(),
  ]);
  // The single exit every session listener already handles — the onboarding
  // store drops its session on it, and the routers ask `signOutDestination`.
  window.dispatchEvent(
    new CustomEvent('auth:logout', { detail: { code: ROLE_CLOSED_SIGN_OUT_CODE } }),
  );
}
