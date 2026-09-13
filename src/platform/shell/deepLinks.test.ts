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
  it('resolves an App Link through the deep-link vocabulary', () => {
    // `/dashboard/shipments/:id` is NOT a route — the shipment list opens its
    // detail sheet from `?open=`. Before this went through `resolveDeepLink`
    // the path was passed along verbatim and the catch-all swallowed it to the
    // Overview.
    expect(routeFromUrl('https://agency.wi-mall.com/dashboard/shipments/abc123')).toBe(
      '/dashboard/shipments?open=abc123',
    );
  });

  it('resolves an emailed button, which carries no /dashboard at all', () => {
    // The shape the email, WhatsApp and Telegram buttons actually use:
    // `{AGENCY_APP_URL}/{path}`. This is the case the whole translation exists
    // for — it used to land on the Overview with no explanation.
    expect(routeFromUrl('https://agency.wi-mall.com/shipments/abc123')).toBe(
      '/dashboard/shipments?open=abc123',
    );
    expect(routeFromUrl('https://agency.wi-mall.com/cod/deposits/dep1')).toBe(
      '/dashboard/cash/deposits?open=dep1',
    );
    expect(routeFromUrl('https://agency.wi-mall.com/vendor-connections/c1')).toBe(
      '/dashboard/vendors/connections?open=c1',
    );
  });

  it('puts a custom-scheme path under /dashboard', () => {
    // `wiagency://shipments/abc123` parses with 'shipments' as the HOST — a
    // custom scheme has no authority — so host and pathname have to be
    // recombined before the label is resolved.
    expect(routeFromUrl('wiagency://shipments/abc123')).toBe('/dashboard/shipments?open=abc123');
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

  it('keeps the query string, and does not treat such a URL as a label', () => {
    // A `?` means somebody shared a real in-app URL carrying its own tab or
    // filter. None of the eight labels has a query string, so this is the
    // signal that resolution must not run — otherwise `?tab=browse` would be
    // thrown away and replaced by the connections tab.
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
      '/dashboard/shipments?open=1',
    );
  });

  it('passes an unknown path through rather than swallowing it', () => {
    // Rule 5: an unrecognised label is "no button", not an error. The router's
    // own fallback decides what to do, which keeps a label the backend adds
    // before we ship a case for it from breaking anything.
    expect(routeFromUrl('https://agency.wi-mall.com/dashboard/not-a-label/9')).toBe(
      '/dashboard/not-a-label/9',
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
      '/dashboard/inventory/requests?open=66f0a1',
    );
  });

  it('tolerates a leading slash on the path', () => {
    expect(routeFromPushData({ path: '/shipments/1' })).toBe('/dashboard/shipments?open=1');
  });

  it('accepts the action_path spelling', () => {
    expect(routeFromPushData({ action_path: 'tickets/7' })).toBe('/dashboard/tickets?open=7');
  });

  it('prefers path over url when both are present', () => {
    expect(routeFromPushData({ path: 'shipments/1', url: 'https://x/dashboard/agents' })).toBe(
      '/dashboard/shipments?open=1',
    );
  });

  it('falls through to url when the path is not a label we know', () => {
    // Rule 5 again, at the push layer: an unknown label must not navigate
    // somewhere invented, so `url` gets its turn before we give up.
    expect(
      routeFromPushData({ path: 'not-a-label/1', url: 'https://x/dashboard/notifications' }),
    ).toBe('/dashboard/notifications');
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
