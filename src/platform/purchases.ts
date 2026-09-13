/**
 * Purchase policy (CAPACITOR-PLAN.md → Phase 5, decision D4).
 *
 * The gate is **per payment method**, not per build. It used to be one flag that
 * turned every purchase off inside the native shell; that was correct for cards
 * and too broad for mobile money, which is how most agencies here actually pay.
 *
 * **Mobile money is live on native.** It completes where the payer already is —
 * a USSD prompt on the handset, or a one-time code typed back into the app — and
 * needs no redirect, no browser, and no return trip. api-doc/payments/README.md
 * says it outright: "Mobile money completes where the customer is … and needs
 * nothing here. A card cannot." Nothing about that flow changes between a
 * desktop browser and a WebView, so nothing about it needs gating.
 *
 * **Cards stay gated on native**, for a reason that is specifically about cards:
 * `PaymentDialog` hands Stripe `return_url: window.location.href` for 3-D
 * Secure. Under a custom hostname (`https://agency.wi-mall.internal`) or
 * `capacitor://` that URL is not somewhere a bank redirect can navigate back to,
 * so a card needing 3-D Secure would take the money and strand the agency
 * outside the app. Gating the entry point leaves that code untouched and
 * unreachable, which is honest; half-fixing the redirect would not be.
 *
 * The store-policy half of the old comment is **not** a reason any more. It was
 * an iOS argument ("a subscription sold in an iOS app is expected to use IAP")
 * and there is no iOS build — no `ios/` directory, the target is Android only.
 * The Google Play exemption being relied on instead is a decision for the
 * project owner, not for this file; see the note in the PR/summary.
 *
 * What this module deliberately does NOT gate: viewing anything, saving a
 * mobile-money number, or the expiry-reminder preference.
 */
import { isNative } from './env';

/**
 * Whether a **card** payment can be started from this build.
 *
 * This is the 3-D Secure redirect-topology question above, and nothing else.
 *
 * Deliberately `!isNative` and not `!useBearerAuth`: forcing the mobile auth
 * transport in a desktop browser (`VITE_FORCE_MOBILE_AUTH`) has to leave the
 * card flow reachable — that browser is where it is developed, and it is still
 * a browser Stripe can redirect back into.
 */
export const cardPurchasesEnabled = !isNative;

/**
 * Whether a **mobile-money** payment can be started from this build.
 *
 * Constant `true`, and typed `boolean` rather than narrowed to `true` so the
 * consumers below read as a gate instead of dead code. There is no platform on
 * which this flow does not work: it never leaves the app, so there is no
 * redirect to land, and it is not a purchase of digital content delivered inside
 * the app either.
 */
export const mobileMoneyPurchasesEnabled: boolean = true;

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
