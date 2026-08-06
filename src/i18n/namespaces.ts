/**
 * Translation namespaces, one per feature area.
 *
 * Namespaces keep the JSON files small enough to review in a PR and let a
 * translator work one surface at a time. They map 1:1 to a directory under
 * `src/components` or a group of pages:
 *
 *   common       shared words: buttons, states, units, generic table chrome
 *   nav          sidebar, mobile tab bar, quick actions, page titles
 *   errors       backend `error.code` → message (see api-doc/error-codes.ts)
 *   validation   client-side form/Zod messages
 *   auth         login / session screens
 *   onboarding   the 4-step onboarding flow
 *   overview     dashboard home
 *   shipments    shipments page + assignment/reassign/reject dialogs
 *   inventory    warehoused vendor stock: list, detail sheet, stock states
 *   tracking     live tracking map
 *   agents       agent directory, contracts, terms negotiation
 *   vendors      vendor connections
 *   cash         COD cash management
 *   tickets      support tickets
 *   billing      plans, credit wallet, payment methods, transactions
 *   notifications notification centre + per-type display copy
 *   media        media library
 *   account      account tabs: profile, security, preferences, payout, billing
 *   settings     agency settings tabs: store, locations, policies, notifications
 */

export const NAMESPACES = [
  'common',
  'nav',
  'errors',
  'validation',
  'auth',
  'onboarding',
  'overview',
  'shipments',
  'inventory',
  'tracking',
  'agents',
  'vendors',
  'cash',
  'tickets',
  'billing',
  'notifications',
  'media',
  'account',
  'settings',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

/** Namespace resolved when a `t()` call names none. */
export const DEFAULT_NAMESPACE: Namespace = 'common';
