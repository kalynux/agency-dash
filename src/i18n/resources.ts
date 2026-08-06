/**
 * Resource loading strategy.
 *
 * English is bundled eagerly: it is the fallback for every other language, so
 * it must be in memory before the first render or a missing key would paint the
 * raw key path. Every other language is code-split and fetched on demand the
 * first time it is selected — five full locales in the entry chunk would be
 * dead weight for the ~90% of sessions that never switch.
 */

import type { Namespace } from './namespaces';
import { NAMESPACES } from './namespaces';
import type { LanguageCode } from './config';

import enAccount from './locales/en/account.json';
import enAgents from './locales/en/agents.json';
import enAuth from './locales/en/auth.json';
import enBilling from './locales/en/billing.json';
import enCash from './locales/en/cash.json';
import enCommon from './locales/en/common.json';
import enErrors from './locales/en/errors.json';
import enInventory from './locales/en/inventory.json';
import enMedia from './locales/en/media.json';
import enNav from './locales/en/nav.json';
import enNotifications from './locales/en/notifications.json';
import enOnboarding from './locales/en/onboarding.json';
import enOverview from './locales/en/overview.json';
import enSettings from './locales/en/settings.json';
import enShipments from './locales/en/shipments.json';
import enTickets from './locales/en/tickets.json';
import enTracking from './locales/en/tracking.json';
import enValidation from './locales/en/validation.json';
import enVendors from './locales/en/vendors.json';

export const enResources = {
  account: enAccount,
  agents: enAgents,
  auth: enAuth,
  billing: enBilling,
  cash: enCash,
  common: enCommon,
  errors: enErrors,
  inventory: enInventory,
  media: enMedia,
  nav: enNav,
  notifications: enNotifications,
  onboarding: enOnboarding,
  overview: enOverview,
  settings: enSettings,
  shipments: enShipments,
  tickets: enTickets,
  tracking: enTracking,
  validation: enValidation,
  vendors: enVendors,
} as const;

/**
 * Lazy loaders for every non-English locale file, keyed `<lang>/<namespace>`.
 * Vite turns each into its own chunk at build time.
 */
const lazyBundles = import.meta.glob<{ default: Record<string, unknown> }>(
  './locales/!(en)/*.json',
);

/**
 * Load every namespace for `language` and hand them to i18next. Missing files
 * are not an error: a locale that has only translated `common` and `errors` so
 * far falls through to English for the rest, which is the intended behaviour
 * while a translation is in progress.
 */
export async function loadLanguageBundles(
  language: LanguageCode,
  addBundle: (lng: string, ns: Namespace, resources: Record<string, unknown>) => void,
): Promise<void> {
  await Promise.all(
    NAMESPACES.map(async (ns) => {
      const loader = lazyBundles[`./locales/${language}/${ns}.json`];
      if (!loader) return;
      try {
        const mod = await loader();
        addBundle(language, ns, mod.default);
      } catch {
        // A malformed or missing bundle must never break the app — English
        // already covers the keys.
      }
    }),
  );
}
