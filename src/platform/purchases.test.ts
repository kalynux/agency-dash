/**
 * Purchase policy (CAPACITOR-PLAN.md → Phase 5, decision D4).
 *
 * Everything here is decided once, at import time, from `isNative` and one env
 * var — so every test re-imports the module under a different world. What is
 * worth pinning down is that the gate stayed *per method* when it was narrowed:
 * a card offered on a phone strands a 3-D Secure redirect, while mobile money
 * silently missing there is the whole feature gone. Plus the URL the card
 * notices point at, which is the only way out of the remaining gate.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';

/** Re-import `purchases.ts` with `isNative` forced either way. */
async function load(isNative: boolean) {
  vi.resetModules();
  vi.doMock('./env', () => ({
    isNative,
    platform: isNative ? 'android' : 'web',
    forceMobileAuth: false,
    useBearerAuth: isNative,
  }));
  return import('./purchases');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('./env');
  vi.resetModules();
});

describe('cardPurchasesEnabled', () => {
  it('is off inside the native shell', async () => {
    expect((await load(true)).cardPurchasesEnabled).toBe(false);
  });

  it('is on in the browser', async () => {
    expect((await load(false)).cardPurchasesEnabled).toBe(true);
  });

  it('ignores the forced-mobile-auth dev override', async () => {
    // VITE_FORCE_MOBILE_AUTH moves the auth transport, not the redirect
    // topology: the card flow has to stay reachable in the browser it is built
    // in, which is still a browser Stripe can redirect back into.
    vi.resetModules();
    vi.doMock('./env', () => ({
      isNative: false,
      platform: 'web',
      forceMobileAuth: true,
      useBearerAuth: true,
    }));
    const { cardPurchasesEnabled } = await import('./purchases');
    expect(cardPurchasesEnabled).toBe(true);
  });
});

describe('mobileMoneyPurchasesEnabled', () => {
  // The point of narrowing the gate. Mobile money completes on the handset with
  // no redirect to land, so there is no platform on which it should be hidden —
  // and a regression here is the entire feature silently gone from the app.
  it('is on inside the native shell', async () => {
    expect((await load(true)).mobileMoneyPurchasesEnabled).toBe(true);
  });

  it('is on in the browser', async () => {
    expect((await load(false)).mobileMoneyPurchasesEnabled).toBe(true);
  });
});

describe('web dashboard URL', () => {
  it('defaults to the production host', async () => {
    const m = await load(true);
    expect(m.webDashboardUrl).toBe('https://agency.wi-mall.com');
    expect(m.webBillingUrl).toBe('https://agency.wi-mall.com/dashboard/account/billing');
    expect(m.webDashboardHost).toBe('agency.wi-mall.com');
  });

  it('honours an override and strips its trailing slashes', async () => {
    vi.stubEnv('VITE_WEB_DASHBOARD_URL', 'http://192.168.0.100:5174//');
    const m = await load(true);
    expect(m.webBillingUrl).toBe('http://192.168.0.100:5174/dashboard/account/billing');
    expect(m.webDashboardHost).toBe('192.168.0.100:5174');
  });

  it('falls back to the default when the override is blank', async () => {
    vi.stubEnv('VITE_WEB_DASHBOARD_URL', '   ');
    expect((await load(true)).webDashboardUrl).toBe('https://agency.wi-mall.com');
  });

  it('does not throw on an unparseable override', async () => {
    // The host is only ever interpolated into a sentence — a bad value must not
    // take the billing page down with it.
    vi.stubEnv('VITE_WEB_DASHBOARD_URL', 'not a url');
    expect((await load(true)).webDashboardHost).toBe('not a url');
  });
});
