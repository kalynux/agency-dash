/**
 * Purchase policy (CAPACITOR-PLAN.md → Phase 5, decision D4).
 *
 * Billing is read-only inside the native shell. The plan catalog, the current
 * plan, the wallet balance, the credit packs and the transaction history all
 * render exactly as they do on the web — nothing is hidden — but a purchase
 * cannot be *started* from a phone. Two independent reasons, either sufficient
 * on its own:
 *
 *  1. **Store policy.** A subscription sold inside an iOS app is expected to go
 *     through In-App Purchase. Not offering the purchase at all sidesteps the
 *     argument entirely, at the cost of one step the agency finishes on the web.
 *
 *  2. **The Stripe return trip has nowhere to land.** `PaymentDialog` hands
 *     Stripe `return_url: window.location.href` for 3-D Secure. Under a custom
 *     hostname (`https://agency.wi-mall.internal`) or `capacitor://` that URL is
 *     not somewhere a bank redirect can navigate back to, so a card needing
 *     3-D Secure would take the money and strand the agency outside the app.
 *     Gating the entry point leaves that code untouched and unreachable, which
 *     is honest; half-fixing the redirect would not be.
 *
 * What this module deliberately does NOT gate: viewing anything, saved payment
 * methods, or the expiry-reminder preference. None of them move money, and a
 * wallet you can see but not manage would be a worse app for no policy benefit.
 */
import { isNative } from './env';

/**
 * Whether a purchase can be *started* from this build.
 *
 * Deliberately `!isNative` and not `!useBearerAuth`: this is a store-policy and
 * redirect-topology question, not an auth-transport one. Forcing the mobile auth
 * transport in a desktop browser (`VITE_FORCE_MOBILE_AUTH`) has to leave the
 * purchase flow reachable — that browser is where the flow is developed.
 */
export const purchasesEnabled = !isNative;

/**
 * Where a purchase is finished instead. Production default; overridable with
 * `VITE_WEB_DASHBOARD_URL` so a LAN dev build can point at the dev server.
 *
 * Trailing slashes are stripped so the paths below concatenate cleanly.
 */
export const webDashboardUrl: string = (
  (import.meta.env.VITE_WEB_DASHBOARD_URL as string | undefined)?.trim() ||
  'https://agency.wi-mall.com'
).replace(/\/+$/, '');

/** The billing page on the web dashboard — the destination of every notice. */
export const webBillingUrl = `${webDashboardUrl}/dashboard/account/billing`;

/**
 * Bare host, for copy that names where the agency is being sent
 * ("…on the web dashboard at agency.wi-mall.com").
 *
 * A malformed override must not take the billing page down over a string used
 * in a sentence, so a `URL` parse failure falls back to the raw value.
 */
export const webDashboardHost: string = (() => {
  try {
    return new URL(webDashboardUrl).host;
  } catch {
    return webDashboardUrl;
  }
})();
