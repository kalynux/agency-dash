import { describe, it, expect } from 'vitest';

// `?raw` rather than `node:fs`, so this stays inside the app's own tsconfig —
// which declares only `vite/client` types, deliberately, so that nothing under
// `src/` can reach for a Node API that the browser bundle would not have.
import devEnvSource from '../../env/.env.development?raw';
import prodEnvSource from '../../env/.env.production?raw';
import swSource from '../../public/firebase-messaging-sw.js?raw';

/**
 * The Firebase web config exists in THREE places and nothing at runtime compares
 * them:
 *
 *   env/.env.development          read by `npm run dev`
 *   env/.env.production           read by `npm run build` and `build:mobile`
 *   public/firebase-messaging-sw.js   hardcoded, because a service worker cannot
 *                                     read Vite env vars
 *
 * Drift between them is the worst kind of bug this app can ship: the page
 * registers a push token against one project and the backend sends to another,
 * so nothing arrives, nothing throws, and the settings screen reports push as
 * working. There is no error to trace back.
 *
 * So the check lives here, where `npm test` runs it. It compares values, never
 * prints them — a failure names the key, and you go and look.
 *
 * ⚠ This asserts the three are IDENTICAL, which is true because `bingoo-22222`
 * is the messaging project for both environments. If they are ever split, this
 * test is the thing to change first — and changing it should be a deliberate
 * act, which is the point.
 */

/** The `VITE_FIREBASE_*` pairs in a dotenv file. Comments and blanks ignored. */
function envFirebase(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('VITE_FIREBASE_')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

/** The `firebase.initializeApp({...})` literal in the service worker. */
function serviceWorkerFirebase(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, key, value] of swSource.matchAll(/(\w+)\s*:\s*'([^']*)'/g)) out[key] = value;
  return out;
}

/** env var ⇄ the key the Firebase SDK reads. `VAPID_KEY` has no SDK-config twin. */
const PAIRS: [envKey: string, sdkKey: string][] = [
  ['VITE_FIREBASE_API_KEY', 'apiKey'],
  ['VITE_FIREBASE_AUTH_DOMAIN', 'authDomain'],
  ['VITE_FIREBASE_PROJECT_ID', 'projectId'],
  ['VITE_FIREBASE_MESSAGING_SENDER_ID', 'messagingSenderId'],
  ['VITE_FIREBASE_APP_ID', 'appId'],
];

const REQUIRED = [...PAIRS.map(([envKey]) => envKey), 'VITE_FIREBASE_VAPID_KEY'];

describe('Firebase push config', () => {
  const dev = envFirebase(devEnvSource);
  const prod = envFirebase(prodEnvSource);
  const sw = serviceWorkerFirebase();

  it.each(REQUIRED)('%s is set in both env files', (key) => {
    // An unset value is not a test failure in the abstract — the client guards
    // it and degrades to "push is not configured for this deployment". It IS a
    // failure here, because production has been declared configured.
    expect(dev[key], `${key} missing from env/.env.development`).toBeTruthy();
    expect(prod[key], `${key} missing from env/.env.production`).toBeTruthy();
  });

  it.each(REQUIRED)('%s is identical in development and production', (key) => {
    expect(prod[key] === dev[key], `${key} differs between the two env files`).toBe(true);
  });

  it.each(PAIRS)('%s matches the service worker’s %s', (envKey, sdkKey) => {
    expect(
      sw[sdkKey] === prod[envKey],
      `${sdkKey} in public/firebase-messaging-sw.js differs from ${envKey}`,
    ).toBe(true);
  });

  it('the service worker names every field the SDK needs', () => {
    for (const [, sdkKey] of PAIRS) {
      expect(sw[sdkKey], `${sdkKey} absent from the service worker config`).toBeTruthy();
    }
  });
});
