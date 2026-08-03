import type { Namespace, TFunction } from 'i18next';

import i18n from './index';

/**
 * A `t` bound to *any* namespace. `useTranslation('nav')` and
 * `useTranslation('agents')` produce differently branded `TFunction`s, and a
 * helper that only forwards a runtime key shouldn't care which one it got.
 */
export type AnyTFunction = TFunction<Namespace>;

/**
 * Translate a key that is only known at runtime.
 *
 * Most `t()` calls name a literal key and are checked against the English
 * bundle. Some can't be: config tables (`config/navigation.ts`), backend enums
 * (shipment status, notification type) and error codes all carry their key as
 * data. `tx` is the one sanctioned escape hatch — grep for it to find every
 * place a key isn't compile-time checked.
 *
 * Pair a dynamic key with `scripts/i18n-audit.mjs` (which checks the error
 * catalog) or with an exhaustive `Record<Enum, Key>` map, so a missing entry is
 * still caught somewhere.
 */
export function tx(
  t: AnyTFunction,
  key: string,
  options?: Record<string, unknown>,
): string {
  return t(key as never, options as never) as unknown as string;
}

/**
 * `tx` outside React — for plain functions and service code that has no hook.
 * Reads the live i18next instance, so it must be called at render/handler time,
 * never captured in a module constant.
 *
 * Returns the key unchanged when there is no entry for it, which lets a caller
 * distinguish "no copy for this value" from a real translation — see
 * `formatVehicleType`, where the backend can send tokens we've never seen.
 */
export function txStatic(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key as never, options as never) as unknown as string;
}
