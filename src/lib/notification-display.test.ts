/**
 * The notification deep-link vocabulary (api-doc/notifications/deep-links.md).
 *
 * The backend pins its half with `npm run test:notification-deeplinks`, whose
 * last assertion is that its own document still lists these eight. This is our
 * half: every label it can send, and exactly one route each.
 *
 * Four of the eight used to resolve. The other four — `shipments/:id`,
 * `tickets/:id`, `vendor-connections/:id`, `cod/deposits/:id` — were prefixed
 * blindly onto `/dashboard/`, matched no route, and were swallowed by the
 * catch-all to the Overview: not a 404, a silent wrong page.
 */
import { describe, it, expect } from 'vitest';
import { resolveDeepLink, notificationHref } from './notification-display';

const ID = '665f1f77bcf86cd799439011';

describe('resolveDeepLink', () => {
  it('resolves all eight agency labels', () => {
    expect(resolveDeepLink(`shipments/${ID}`)).toBe(`/dashboard/shipments?open=${ID}`);
    expect(resolveDeepLink(`tickets/${ID}`)).toBe(`/dashboard/tickets?open=${ID}`);
    expect(resolveDeepLink(`vendor-connections/${ID}`)).toBe(
      `/dashboard/vendors/connections?open=${ID}`,
    );
    expect(resolveDeepLink(`cod/deposits/${ID}`)).toBe(`/dashboard/cash/deposits?open=${ID}`);
    expect(resolveDeepLink(`stock-requests/${ID}`)).toBe(
      `/dashboard/inventory/requests?open=${ID}`,
    );
    expect(resolveDeepLink(`agents/${ID}`)).toBe(`/dashboard/agents/${ID}`);
    expect(resolveDeepLink('plans')).toBe('/dashboard/account/billing');
    expect(resolveDeepLink('settings/storage')).toBe('/dashboard/media');
  });

  it('keeps `settings/storage` a label rather than reading `storage` as an id', () => {
    // Why the whole path is tried before splitting at the last slash. Getting
    // this backwards sends a storage alert to the settings screen with a
    // meaningless `?open=storage`.
    expect(resolveDeepLink('settings/storage')).toBe('/dashboard/media');
    expect(resolveDeepLink('settings/policies')).toBeNull();
  });

  it('carries a CONTRACT id on `agents`, landing on the tab slot', () => {
    // `Agents.tsx` sniffs a contract id in `:tab` on purpose. Noted because a
    // future `agents/:agentId` route would silently capture this.
    expect(resolveDeepLink(`agents/${ID}`)).toBe(`/dashboard/agents/${ID}`);
  });

  it('finds the id by position, not by shape', () => {
    // Rule 3 is "at most one id, always last" and says nothing about ObjectIds.
    // Pattern-matching 24 hex characters instead would drop the button the day
    // an id looks different.
    expect(resolveDeepLink('shipments/7')).toBe('/dashboard/shipments?open=7');
    expect(resolveDeepLink('tickets/TCK-2026-1')).toBe('/dashboard/tickets?open=TCK-2026-1');
  });

  it('tolerates the shapes a URL arrives in', () => {
    expect(resolveDeepLink(`/shipments/${ID}`)).toBe(`/dashboard/shipments?open=${ID}`);
    expect(resolveDeepLink(`/dashboard/shipments/${ID}`)).toBe(`/dashboard/shipments?open=${ID}`);
    expect(resolveDeepLink(`shipments/${ID}/`)).toBe(`/dashboard/shipments?open=${ID}`);
    expect(resolveDeepLink(`//dashboard//shipments/${ID}`)).toBe(
      `/dashboard/shipments?open=${ID}`,
    );
    expect(resolveDeepLink(`shipments/${ID}?utm=x`)).toBe(`/dashboard/shipments?open=${ID}`);
  });

  it('returns null for an unknown label rather than inventing a destination', () => {
    // Rule 5. This is what lets the backend add a label before we ship a case
    // for it: the worst outcome is a notification that does not navigate.
    expect(resolveDeepLink('bookings/1')).toBeNull();
    expect(resolveDeepLink('products/1')).toBeNull();
    expect(resolveDeepLink('')).toBeNull();
    expect(resolveDeepLink('/')).toBeNull();
    expect(resolveDeepLink('dashboard')).toBeNull();
  });

  it('resolves an idless label to its landing screen', () => {
    // The backend never sends these bare, but a person editing a URL might.
    expect(resolveDeepLink('shipments')).toBe('/dashboard/shipments');
    expect(resolveDeepLink('agents')).toBe('/dashboard/agents/connections');
  });
});

describe('notificationHref', () => {
  it('falls back to the inbox, which is always true', () => {
    // The notification the user tapped is on it — unlike any screen we could
    // guess at from a label we do not know.
    expect(notificationHref(null)).toBe('/dashboard/notifications');
    expect(notificationHref({ label: 'View', path: '' })).toBe('/dashboard/notifications');
    expect(notificationHref({ label: 'View', path: 'bookings/1' })).toBe(
      '/dashboard/notifications',
    );
  });

  it('routes a known action to its screen', () => {
    expect(notificationHref({ label: 'View shipment', path: `shipments/${ID}` })).toBe(
      `/dashboard/shipments?open=${ID}`,
    );
  });
});
