/**
 * Purchase policy (CAPACITOR-PLAN.md → Phase 5, decision D4).
 *
 * Everything here is decided once, at import time, from `isNative` and one env
 * var — so every test re-imports the module under a different world. The two
 * things worth pinning down are the gate itself (a purchase button appearing on
 * a phone is a store rejection, one silently missing on the web is lost revenue)
 * and the URL the notices point at, which is the only way out of the gate.
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

describe('purchasesEnabled', () => {
  it('is off inside the native shell', async () => {
    expect((await load(true)).purchasesEnabled).toBe(false);
  });

  it('is on in the browser', async () => {
    expect((await load(false)).purchasesEnabled).toBe(true);
  });

  it('ignores the forced-mobile-auth dev override', async () => {
    // VITE_FORCE_MOBILE_AUTH moves the auth transport, not the store policy:
    // the purchase flow has to stay reachable in the browser it is built in.
    vi.resetModules();
    vi.doMock('./env', () => ({
      isNative: false,
      platform: 'web',
      forceMobileAuth: true,
      useBearerAuth: true,
    }));
    const { purchasesEnabled } = await import('./purchases');
    expect(purchasesEnabled).toBe(true);
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
