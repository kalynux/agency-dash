/**
 * Deep-link resolution (CAPACITOR-PLAN.md → P4.2).
 *
 * The two link shapes carry the path at different depths, and the failure mode
 * of getting it wrong is silent: the app opens, navigates *somewhere*, and the
 * notification looks like it worked. So the table below is the whole point of
 * the file — every shape that can arrive, and exactly one route it must produce.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../env', () => ({ isNative: false, platform: 'web', useBearerAuth: false }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: { addListener: vi.fn() } }));

import { routeFromPushData, routeFromUrl } from './deepLinks';

describe('routeFromUrl', () => {
  it('takes an App Link path as the route it already is', () => {
    // Minted against the web app, whose routes are the app's routes.
    expect(routeFromUrl('https://agency.wi-mall.com/dashboard/shipments/abc123')).toBe(
      '/dashboard/shipments/abc123',
    );
  });

  it('puts a custom-scheme path under /dashboard', () => {
    // `wiagency://shipments/abc123` parses with 'shipments' as the HOST — a
    // custom scheme has no authority — so host and pathname have to be
    // recombined before the dashboard prefix goes on.
    expect(routeFromUrl('wiagency://shipments/abc123')).toBe('/dashboard/shipments/abc123');
  });

  it('handles a custom-scheme link with a single segment', () => {
    expect(routeFromUrl('wiagency://notifications')).toBe('/dashboard/notifications');
  });

  it('does not double the /dashboard prefix on a web link that already has it', () => {
    // The regression the two branches exist to prevent.
    expect(routeFromUrl('https://agency.wi-mall.com/dashboard/tickets/9')).not.toContain(
      '/dashboard/dashboard',
    );
  });

  it('keeps the query string', () => {
    expect(routeFromUrl('https://agency.wi-mall.com/dashboard/agents?tab=connections')).toBe(
      '/dashboard/agents?tab=connections',
    );
    expect(routeFromUrl('wiagency://agents?tab=browse')).toBe('/dashboard/agents?tab=browse');
  });

  it('ignores the origin entirely', () => {
    // The WebView serves the app from agency.wi-mall.internal while links are
    // minted against agency.wi-mall.com. Comparing hosts would reject every
    // real link; the intent filter is what vouched for this URL already.
    expect(routeFromUrl('https://wi-mall.com/dashboard/shipments/1')).toBe(
      '/dashboard/shipments/1',
    );
  });

  it('normalises duplicate and trailing slashes', () => {
    expect(routeFromUrl('https://agency.wi-mall.com//dashboard//media/')).toBe('/dashboard/media');
  });

  it('returns null for a link with nothing to go to', () => {
    expect(routeFromUrl('https://agency.wi-mall.com')).toBeNull();
    expect(routeFromUrl('https://agency.wi-mall.com/')).toBeNull();
  });

  it('returns null for anything that is not a URL', () => {
    expect(routeFromUrl('not a url')).toBeNull();
    expect(routeFromUrl('')).toBeNull();
  });
});

describe('routeFromPushData', () => {
  it('resolves the app-relative path the backend mints', () => {
    // Mirrors AgencyNotificationAction.path — the same string the in-app
    // notifications list resolves through notificationHref.
    expect(routeFromPushData({ path: 'stock-requests/66f0a1' })).toBe(
      '/dashboard/stock-requests/66f0a1',
    );
  });

  it('tolerates a leading slash on the path', () => {
    expect(routeFromPushData({ path: '/shipments/1' })).toBe('/dashboard/shipments/1');
  });

  it('accepts the action_path spelling', () => {
    expect(routeFromPushData({ action_path: 'tickets/7' })).toBe('/dashboard/tickets/7');
  });

  it('prefers path over url when both are present', () => {
    expect(routeFromPushData({ path: 'shipments/1', url: 'https://x/dashboard/agents' })).toBe(
      '/dashboard/shipments/1',
    );
  });

  it('falls back to a fully-qualified url', () => {
    expect(routeFromPushData({ url: 'https://agency.wi-mall.com/dashboard/agents/42' })).toBe(
      '/dashboard/agents/42',
    );
  });

  it('ignores a blank or whitespace-only path', () => {
    // FCM flattens data to strings, so an unset field arrives as '' rather than
    // as absent — and '' would otherwise resolve to the dashboard root and look
    // like a deliberate destination.
    expect(routeFromPushData({ path: '   ' })).toBeNull();
    expect(routeFromPushData({ path: '' })).toBeNull();
  });

  it('returns null for a payload carrying no destination', () => {
    expect(routeFromPushData({ title: 'Shipment assigned' })).toBeNull();
    expect(routeFromPushData({})).toBeNull();
    expect(routeFromPushData(null)).toBeNull();
    expect(routeFromPushData(undefined)).toBeNull();
    expect(routeFromPushData('shipments/1')).toBeNull();
  });

  it('ignores a non-string path', () => {
    expect(routeFromPushData({ path: 42 })).toBeNull();
  });
});
