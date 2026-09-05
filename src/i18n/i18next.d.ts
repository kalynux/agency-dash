/**
 * Type-safe translation keys.
 *
 * The English bundle is the schema: `t('shipments:table.trackingNumber')` is
 * checked at compile time, and a typo or a key deleted from `en/*.json` becomes
 * a build error rather than a raw key painted into the UI. Other locales are
 * intentionally *not* part of the type — they are allowed to lag behind English
 * and fall back per key.
 */

import type { enResources } from './resources';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: typeof enResources;
    returnNull: false;
  }
}
