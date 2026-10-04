/**
 * Deep links into the Stock tab.
 *
 * There is no per-row page: a row opens as the detail sheet over the roster, so
 * a link to one row is the roster plus `?open=<stockLevelId>` — the same id
 * `GET /agency/inventory/:id` takes. The Stock tab reads it on mount, so the link
 * survives a cold page load as well as an in-app click.
 */
export const INVENTORY_OPEN_PARAM = 'open';

export function inventoryRowPath(stockLevelId: string): string {
  return `/dashboard/inventory/stock?${INVENTORY_OPEN_PARAM}=${encodeURIComponent(stockLevelId)}`;
}
