# Capacitor Implementation Plan — Agency Dashboard

**Status:** Phase 2 code complete (P2.1–P2.9). Phase 1 code complete (P1.1–P1.12) — exit criteria for both partly verified, see the checklists at the end of each phase
**Audit:** Phase 0 complete — see the [readiness assessment](https://claude.ai/code/artifact/e0ae9065-b533-471f-90a6-5a12e2bba9f2)
**Target:** Android first, then iOS. Web build must remain behaviourally identical throughout.

---

## Approved decisions

These were open questions in the audit. All are now settled and the plan below assumes them.

| # | Decision | Consequence |
|---|---|---|
| D1 | **Custom hostname**, not `localhost` | WebView origin becomes `https://<hostname>` (Android) / `capacitor://<hostname>` (iOS). Closes the loopback-CORS gap the backend flagged. |
| D2 | **CORS ticket filed** against wi-mall *and* geo-tracker | Gates Phase 2. Nothing native works until it lands. |
| D3 | **Login + registration + password reset** all in-app | Registration is agency-role sign-up, landing straight into the existing onboarding flow. |
| D4 | **Billing is read-only on mobile** | Plan upgrades and credit top-ups point at the web dashboard. Viewing invoices, transactions, and plan status stays. Avoids the App Store IAP argument entirely. |
| D5 | Confirm `platform: 'android' \| 'ios'` on `POST /api/agency/devices` | Near-certain (the Flutter agent app already sends these to `/agent/devices`). One message, not one debugging session. |

## Ground rules

1. **No screen is redesigned.** The mobile layout already exists and is correct. New UI is limited to the three auth screens, which have never existed in this app.
2. **Capacitor is imported in exactly one directory** — `src/platform/`. If a component imports `@capacitor/*`, the change is wrong.
3. **Every platform module falls back to today's browser behaviour** when `isNative` is false. The web build is the control group.
4. **Reuse before writing.** The landing site has a complete, well-commented auth layer; this app already has `PhoneInput`, `RegionPicker`, `lib/phone.ts`, form/field primitives, and an onboarding flow. Port and wire, do not reinvent.
5. **Each phase ends somewhere shippable.** The web build is never left broken between phases.

---

# Phase 1 — Auth foundation (no Capacitor yet)

**Goal:** the bearer transport works, proven in a desktop browser against `/api/auth/mobile/*`, before any native tooling exists. This de-risks the hardest part of the project while the toolchain is still fast.

**Branch:** `mobile/phase-1-auth`

### P1.1 — Platform environment module

**New:** `src/platform/env.ts`

```ts
export const isNative = false;   // Phase 2 replaces this with Capacitor.isNativePlatform()
export const platform: 'web' | 'android' | 'ios' = 'web';
```

Plus a dev-only override so the bearer path can be exercised in a browser:
read `VITE_FORCE_MOBILE_AUTH=true` (only honoured when `import.meta.env.DEV`).
This flag is the entire testing strategy for Phase 1 — treat it as load-bearing.

**Done when:** `isNative` is importable and every other module in this phase reads it from here, never from `window` sniffing.

### P1.2 — Auth strategy interface

**New:** `src/platform/auth/strategy.ts`

One interface, two implementations. The strategy answers four questions and nothing else:

```ts
export interface AuthStrategy {
  /** Headers to merge into every request. */
  authHeaders(): Promise<Record<string, string>>;
  /** Whether fetch should send cookies. */
  credentials: RequestCredentials;
  /** Perform a refresh. Throws ApiError on failure. */
  refresh(): Promise<void>;
  /** Endpoint paths that differ between transports. */
  paths: { login: string; register: string; addRole: string; authMe: (role: string) => string };
}
```

| | `CookieAuthStrategy` (web) | `BearerAuthStrategy` (native) |
|---|---|---|
| headers | `{}` | `{ Authorization: 'Bearer <access>' }` |
| credentials | `'include'` | `'omit'` |
| refresh | `POST /auth/browser/refresh` (must send `Content-Type: application/json` — it sits behind `requireJsonContent`) | `POST /auth/mobile/refresh` with `{ refreshToken }`, stores **both** returned tokens |
| login | `/auth/login` | `/auth/mobile/login` |
| register | `/auth/register` | `/auth/mobile/register` |
| add-role | `/auth/add-role` | `/auth/mobile/add-role` |
| auth-me | `/auth/auth-me/:role` | `/auth/mobile/auth-me/:role` |

**Critical:** mobile refresh returns a *fresh pair*. Storing only the access token silently discards the sliding 30-day window and the user is signed out mid-use a month later. Store both, always.

**Critical:** never test refresh success by comparing token strings. A JWT's `iat` is in whole seconds, so two mints in the same second are byte-identical. Use the HTTP status.

### P1.3 — Refactor `src/services/api.ts` to take a strategy

**Modified:** `src/services/api.ts`

The subtle part of this file — the single-flight refresh queue that holds concurrent 401s — must be written **once** and shared by both transports. Do not branch on `isNative` inside `request()`.

- Replace the hardcoded `credentials: 'include'` with `strategy.credentials`.
- Merge `await strategy.authHeaders()` into every request.
- Replace the `refreshTokens()` body with `strategy.refresh()`.
- Keep `TERMINAL_AUTH_CODES` and extend it — see P1.4.
- Keep the `auth:logout` window event as the single exit for both modes.

**Done when:** the diff shows no new `if (isNative)` inside the request path.

### P1.4 — Terminal vs. recoverable auth errors

**Modified:** `src/services/api.ts`

Branch on `error.code`, never on the status.

| Code | Status | Action |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` | 401 | **Refresh** — the only non-terminal one |
| `AUTH_MISSING_TOKEN` | 401 | Sign out |
| `AUTH_REFRESH_TOKEN_INVALID` | 401 | Sign out. In dev this almost always means the *access* token was sent |
| `AUTH_SESSION_EXPIRED` | 401 | Sign out, prompt login |
| `AUTH_PASSWORD_CHANGED` | 401 | Sign out immediately, do not retry. Surface the message verbatim — to someone who did not change their password it is the first sign somebody else did |
| `AUTH_ACCOUNT_SUSPENDED` | 403 | Sign out, show the reason |
| `AUTH_USER_NOT_FOUND` | 401 | Sign out |
| `RATE_LIMIT_EXCEEDED` | 429 | **Do not sign out.** Respect `Retry-After`; never retry-storm |

### P1.5 — Token store interface

**New:** `src/platform/auth/tokenStore.ts`

```ts
export interface TokenStore {
  get(): Promise<Tokens | null>;
  set(t: Tokens): Promise<void>;
  clear(): Promise<void>;
}
```

Phase 1 ships two implementations: a no-op (web — cookies hold the session) and an in-memory one (used by the `VITE_FORCE_MOBILE_AUTH` dev path). Phase 2 adds the secure one. Keep an in-memory cache in front of whichever backend is active so the hot path does not await native storage on every request.

Store alongside the tokens: `accessExpiresAt` (computed as `Date.now() + accessExpiresIn * 1000` at receipt). The scheduler in Phase 2 needs an absolute instant, not a duration.

### P1.6 — Apply the strategy to the upload XHR

**Modified:** `src/services/files.service.ts`

This file hand-builds `XMLHttpRequest` for upload progress and authenticates with `xhr.withCredentials = true`, bypassing `api.ts` entirely. It needs the same treatment or uploads become the one feature that fails *after* login succeeds.

- `xhr.withCredentials = strategy.credentials === 'include'`
- Apply `await strategy.authHeaders()` via `xhr.setRequestHeader` after `open()`
- Both call sites: `/files/upload` and `/files/upload/video`

**Also audit for the same pattern:** `src/services/geo-tracker.service.ts` builds its own `fetch` with `credentials: 'include'` (handled in Phase 4) and `src/lib/stripe.ts` loads a third-party script (Phase 5). No other module bypasses `api.ts`.

### P1.7 — Auth service surface

**Modified:** `src/services/auth.service.ts`

Add the calls the new screens need, all routed through `strategy.paths` so one implementation serves both transports:

- `login({ identifier, password, role: 'agency' })`
- `register({ phone, email?, name, password, role: 'agency', agency_name })`
- `getAuthMeAgency()` — already exists; must now route through `strategy.paths.authMe`
- `forgotPassword(identifier)` → `POST /auth/forgot-password` — base namespace, works unchanged from both transports
- `resetPassword(token, newPassword)` → `POST /auth/reset-password` — same

On every response carrying `data.tokens` (login, register, auth-me, refresh, add-role), hand them to the token store. On web that is a no-op; the code path is identical.

**Logout:** on native, discard the tokens — no server call is needed. Keep the `POST /auth/logout` call on web. Unregister the push token *first* (Phase 4) since that call needs the credential it is about to destroy.

### P1.8 — Login screen

**New:** `src/pages/Login.tsx`, replacing `LoginRedirectScreen` in `src/App.tsx:103`
**Also:** delete the hardcoded `LOGIN_URL = 'http://localhost:3000/login'` at `src/App.tsx:59`

Port the schema from `frontend/landing/src/lib/auth/auth.schemas.ts` (`LoginSchema`) rather than writing a new one — it encodes real backend behaviour in its comments.

- Single `identifier` field that is **either** a phone or an email, with an explicit toggle. One field cannot honestly be both: a phone needs a country selector and E.164 normalisation, an email must get neither.
- `identifier_type` drives the UI only and is stripped before submit.
- Phone path reuses this app's existing `PhoneInput` + `RegionPicker` + `lib/phone.ts` (`toE164`, `phoneIssue`) — already present, already localised.
- Password min 6 (registration's rule, which is what login validates against).
- `role: 'agency'` is fixed — this is the agency dashboard.
- On success: read `role_entity.onboarding_step` and route. `0` → `/dashboard`, anything else → `/onboarding`.

Visual treatment: match the landing site's `AuthCard` / `AuthFormField` composition, rebuilt on this app's shadcn primitives. Do not invent a third auth look.

### P1.9 — Registration screen

**New:** `src/pages/Register.tsx`, route `/register`

Port `RegisterSchema` from the landing site. For the agency role the fields are:

| Field | Rule | Notes |
|---|---|---|
| `phone` | Required, E.164 | Validated against the selected country's numbering plan. Reuse `PhoneInput`. |
| `name` | Required, min 2 | The person. Lands on the role profile as `display_name`. |
| `agency_name` | Required, 2–100 | Seeds `Magazin.name` on a *separate* document — this is why the returned `role_entity` has no `agency_name` field. The endpoint itself does not validate length: shorter is silently padded, longer is truncated at 100. Enforce the real bounds client-side so the name typed is the name saved. |
| `email` | Optional | Required for vendors only, not agencies. |
| `password` | Required, min 6 | Registration's rule is *looser* than password reset's — see P1.10. |

- `role: 'agency'` fixed.
- On success the response carries `user`, `role`, `role_entity`, and `tokens`. Store the tokens, then route on `onboarding_step` — a fresh agency lands at step 1 (logistics), so this flows straight into the existing onboarding subsystem with no new work.
- Phone/WhatsApp verification is **not** part of registration. It already exists in-app under agency settings (`WhatsappLinkCard`, `ChannelSetupDialog`). Leave it there.
- Rate limit: registration sits in the credential bucket at 20/min/IP. Disable the submit button while in flight; surface `Retry-After` on 429.

### P1.10 — Forgot / reset password

**New:** `src/pages/ForgotPassword.tsx`, route `/forgot-password`

- One field accepting an email **or** an E.164 phone. Do not try to classify it — the backend accepts both, and guessing in order to reject the other is how a legitimate identifier gets refused before it is sent.
- **The endpoint always answers 200**, whether or not the account exists. Never branch the UI on the response; a different message for "no such account" turns this into an account-enumeration oracle. Show the same "check your messages" screen every time.
- The reset link itself lands on the web app. For v1 the user completes reset in a browser and returns to sign in. Bringing reset in-app via deep link is a Phase 4 enhancement, not a launch requirement.
- If reset *is* completed in-app later: its password rule is **stricter** than registration — 8 characters with an upper, a lower, a digit and a symbol. The two genuinely disagree server-side. Mirroring the loose rule would let a user submit a password the API then rejects.
- Worth telling the user: a successful reset signs out every other device. That is intended.

### P1.11 — Session bootstrap wiring

**Modified:** `src/onboarding/store/onboarding.store.tsx`

This store is already the session owner — `initialize()` calls `authService.getAuthMeAgency()` and every guard reads from it. It needs three changes:

1. Route `getAuthMeAgency()` through `strategy.paths.authMe` (falls out of P1.7).
2. Persist the `tokens` on the auth-me response — this is the launch-time refresh, and forgetting it means the app runs on the login token until it expires.
3. On native, skip the call entirely when the token store is empty and go straight to `/login` — no point spending a request to be told we are anonymous.

**Modified:** `src/App.tsx` — add `/register` and `/forgot-password` as public routes beside `/login`, outside `OnboardingGuard`.

### P1.12 — Optional but recommended: unit tests for the auth core

There is no test runner in this project, and the auth fork is its highest-consequence change. Add Vitest covering **only** pure logic:

- strategy selection and path resolution
- terminal vs. recoverable error classification (P1.4 table)
- token expiry arithmetic
- the refresh scheduler (Phase 2), with fake timers

Not components, not integration. Four small files that make the rest of the project safe to refactor.

**Landed as three files** — the fourth, the refresh scheduler, is Phase 2 code and
arrives with P2.5:

```
src/platform/auth/tokenStore.test.ts   expiry arithmetic, shape guards, dev store
src/platform/auth/strategy.test.ts     selection, path resolution, refresh contract
src/services/api.errors.test.ts        the P1.4 table, plus the error builder
```

Run with `npm test` (`vitest run`) or `npm run test:watch`. Config lives in
`vitest.config.ts`, deliberately separate from `vite.config.ts` so the app build —
the control group for this whole migration — stays untouched.

### Phase 1 exit criteria

Run every check in **both** modes — normally, and with `VITE_FORCE_MOBILE_AUTH=true`.

- [ ] Login with phone succeeds; login with email succeeds
- [ ] Registration creates an agency and lands on onboarding step 1
- [ ] Onboarding completes end to end and reaches the dashboard
- [ ] Hard refresh restores the session (cookie mode) / restores from the token store (bearer mode)
- [ ] A file upload with progress succeeds — the P1.6 regression
- [ ] Access-token expiry triggers exactly one refresh under concurrent requests (open the dashboard, which fires several polls at once)
- [ ] A terminal error signs out cleanly and lands on `/login`
- [ ] 429 does **not** sign the user out
- [x] `npm run build` is clean. `npm run lint` reports **no new problems** — the 20
      errors it prints are all pre-existing `react-refresh/only-export-components`
      in `src/store/*` and `src/components/ui/*`, files Phase 1 never touched.
      Not clean, but unchanged; cleaning them is its own task.
- [x] Unit tests pass: 75 across the three files above
- [ ] Web smoke sweep: shipments, agents, inventory, tracking, tickets, media, settings, billing view

**Verified against the running dev backend (curl, no browser):** the bearer path
table resolves (`/api/auth/mobile/{login,refresh,auth-me/agency}` all answer, none
404); `/auth/browser/refresh` without `Content-Type: application/json` really does
answer `400 VALIDATION_ERROR — "Only JSON content is accepted"`, and answers
`401 AUTH_MISSING_TOKEN` with it, exactly as `cookieAuthStrategy.refresh()` assumes;
a bad refresh token answers `401 AUTH_REFRESH_TOKEN_INVALID` (terminal — sign out);
validation errors carry `details.fields[{path,message,code}]`, the shape
`ApiError.fieldErrors()` normalises. The trailing slash in
`env/.env.development`'s `VITE_API_BASE_URL` produces a `//` in every path and the
backend tolerates it — worth tidying, not a blocker.

The unchecked boxes all need a signed-in session in a browser.

---

# Phase 2 — Capacitor shell (Android)

**Goal:** a real app on a real device that logs in and stays logged in.
**Blocked by:** D2 (CORS origins live on both services).
**Branch:** `mobile/phase-2-shell`

### P2.1 — Install and initialise

```bash
npm i @capacitor/core @capacitor/app @capacitor/keyboard @capacitor/status-bar \
      @capacitor/network @capacitor/browser @capacitor/splash-screen
npm i -D @capacitor/cli
npx cap init
npm i @capacitor/android
npx cap add android
```

> **Note:** npm in this environment fails TLS verification against the registry. Use a one-off
> `--strict-ssl=false` for these installs.

**Commit `android/`** to the repo — it is required for CI and for any native config change to be reviewable. Add the build artifacts (`android/app/build/`, `android/.gradle/`, `*.iml`, `local.properties`) to `.gitignore`.

Housekeeping while here: `node_modules/.tmp/tsconfig.app.tsbuildinfo` is currently tracked in git. Untrack it.

**Landed.** Capacitor **8.5.0** (`@capacitor/{core,cli,android,app,keyboard,status-bar,network,browser,splash-screen}`), plus `@aparajita/capacitor-secure-storage@8` for P2.4 and, as dev dependencies, `@capacitor/assets` (P2.9), `cross-env` (the LAN sync script) and `jsdom` (the scheduler test).

`npx cap add android` was used rather than `npx cap init` — the config was hand-written (it is checked in below) and `init` only exists to generate it interactively.

`android/.gitignore` arrives from Capacitor's own Android template and already covers every artifact the list above names — `build/`, `.gradle/`, `*.iml`, `local.properties` — as well as the copied web assets (`app/src/main/assets/public`) and the generated `capacitor.config.json`. No root `.gitignore` change was needed.

`capacitor.config.ts` was added to `tsconfig.node.json`'s `include`, so `npm run build` type-checks it alongside the Vite and Vitest configs.

⚠ The tsbuildinfo files are untracked, but they were the tip of a larger accident: **all 26,855 files under `node_modules/` are tracked in git**, despite `/node_modules` being in `.gitignore`. Untracking the rest is a 26k-file commit and a separate decision.

### P2.2 — `capacitor.config.ts`

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // No hyphen here on purpose: an Android package segment must be a valid Java
  // identifier, so `com.wi-mall.agency` is rejected by the toolchain. The
  // hyphenated brand lives in appName and the hostname, which both allow it.
  appId: 'com.wi_mall.agency',
  appName: 'Wi-Agency',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'agency.wi-mall.internal',   // ← D1
  },
  android: { allowMixedContent: false },
};
export default config;
```

**The hostname must be one the app never needs to reach over the network.** The WebView intercepts every request to it and serves local files instead, so pointing it at a live domain makes that domain unreachable from inside the app. `.internal` is reserved for private use and can never route — that is the point of choosing it.

This makes the origins:
- Android → `https://agency.wi-mall.internal`
- iOS → `capacitor://agency.wi-mall.internal`

Both strings go in the D2 ticket. Confirm them with the backend before the ticket is filed, not after.

**Landed with two additions the plan did not anticipate.**

*`plugins.SplashScreen`* — see P2.9.

*`allowMixedContent` is now a flag, not a constant.* The plan set it to a hard
`false`, which is right for production and makes LAN development impossible: the
WebView origin is `https://agency.wi-mall.internal`, so a call to a plain
`http://192.168.x.x:8022` dev API is mixed content and is dropped before it
reaches the network — indistinguishable, from inside the app, from the backend
being down. It now reads `process.env.CAP_LAN_DEV`, which only
`npm run sync:android:lan` sets. The Android half of the same problem
(cleartext is blocked outright since Android 9) is granted in
`android/app/src/debug/AndroidManifest.xml`, a **debug-only** overlay the manifest
merger cannot apply to a release build.

### P2.3 — Flip `isNative`

**Modified:** `src/platform/env.ts` — replace the stub with `Capacitor.isNativePlatform()` and `Capacitor.getPlatform()`. This is the moment the bearer strategy activates on device. Everything it needs was built and tested in Phase 1.

**Landed.** `getPlatform()` returns `string` (custom platforms can be registered), so it is narrowed to the three we ship and anything else is treated as `'web'` — an unknown platform gets browser behaviour rather than reaching for plugins that may not be there. `useBearerAuth` is unchanged and still the flag the auth layer reads; `isNative` remains the one that gates plugins.

### P2.4 — Secure token storage

```bash
npm i @aparajita/capacitor-secure-storage
```

**New:** `src/platform/auth/secureTokenStore.ts` implementing the P1.5 interface against Keychain (iOS) and Keystore-backed encrypted storage (Android).

**`@capacitor/preferences` is not acceptable here** — it is plaintext `SharedPreferences` on Android, and the backend spec is explicit that tokens must not live in plain preferences. A 30-day sliding refresh token in plaintext on a rooted device is a standing session for whoever finds it.

Keep the in-memory cache in front (P1.5) so request latency is unaffected.

**Landed**, with one structural change and two behaviours worth naming.

*Structure.* `tokenStore.ts` selects the secure store, and the secure store needs
`stampExpiry` / `isUsableTokens` — an import cycle. The pure primitives moved to a
new `src/platform/auth/tokens.ts`, which both sides import one-way;
`tokenStore.ts` re-exports them, so no existing import site changed.

*The cache is a shared promise, not a boolean.* `sessionStorage` in the dev store
is synchronous; a Keystore read is not, and the app fires several requests at
once on launch. A `hydrated` flag would let each of them start its own read.

*A storage failure never fails the caller.* Keystore is genuinely flaky on a
minority of devices — a changed lock screen can invalidate keys — and throwing
from `set()` would turn a successful login into a failed one. The write is
swallowed and logged; the session survives in memory for this launch and simply
does not outlive a relaunch, which is a far smaller failure than not signing in.
A `StorageError` of `invalidData` on read clears the entry rather than retrying it.

The string API (`getItem`/`setItem` + `JSON`) is used rather than the object one:
`get()`/`set()` reinterpret ISO-8601 strings as `Date`s and take a
`Record<string, unknown>` our fixed-shape payload does not satisfy.

Selection order is `isNative ? secure : forceMobileAuth ? dev : noop` — native
first on purpose, so a stale `VITE_FORCE_MOBILE_AUTH` can never downgrade a real
install from the Keystore to `sessionStorage`.

### P2.5 — Proactive refresh scheduler

**New:** `src/platform/auth/refreshScheduler.ts`

- Schedule a refresh at `accessExpiresAt - 60s`. Access tokens live 900s, so this is roughly one call per 14 minutes per active user — comfortably inside the 300/min/IP session bucket.
- **Also check on resume.** Background timers are unreliable across app suspension; on `appStateChange → active`, refresh immediately if the token is expired or within 60s of it. Do not rely on the timer alone.
- Share the single-flight lock with the reactive 401 path from P1.3, or a resume-plus-request race fires two refreshes and one of them invalidates the other's result.
- Cancel on logout.

**Landed**, and sharing the lock decided the shape of the module.

`refreshSession()` — the single-flight refresh — now **lives in the scheduler**
and `api.ts` imports it in place of its direct `authStrategy.refresh()` call. The
alternative, two locks, is the exact race the plan warns about. `api.ts` keeps
its own queue: that is about retrying held *requests*, which is its job.

*Started from `captureSession()`* in `auth.service.ts` — the one place a new
access-token deadline ever comes into existence, since login, register and
auth-me all funnel through it. Cancelled from the `auth:logout` event and
directly from `authService.logout()`.

*Inert on the cookie transport.* The no-op token store has no expiry to schedule
against, so no timer is ever armed and the web build keeps precisely the reactive
behaviour Phase 1 shipped. Only the lock is shared — around a call `api.ts` was
already making one at a time.

*A scheduled refresh never signs anyone out.* Its two failure modes are a dead
network — extremely ordinary on a phone, and no statement at all about the
session — and a real refusal, which `api.ts` already delivers correctly the
moment the user does anything. So: 429 backs off for `Retry-After`, a non-`ApiError`
retries in 30s, and a terminal `ApiError` stops the timer and leaves the verdict
to the request path. Acting on the terminal case here would mean a tunnel or a
lift logging people out.

*A spin guard the plan did not call for.* Writing the tests surfaced a real loop:
refresh → re-arm from the new deadline → find it already past → refresh again. A
fresh token normally makes that impossible, unless the device clock runs more
than a minute ahead of the server's — the case nobody can reproduce and every
fleet eventually contains. `MIN_REFRESH_INTERVAL_MS` (30s) floors it. In healthy
operation refreshes are ~14 minutes apart, so it only engages when something is
already wrong.

*Resume re-arms unconditionally*, not only when the token is near expiry:
Android Doze and iOS suspension make the remaining time on a pending timer
untrustworthy after a suspension. On native the signal is `@capacitor/app`'s
`appStateChange`; in a browser it is `visibilitychange`, so the
`VITE_FORCE_MOBILE_AUTH` path behaves the same when a laptop wakes.

### P2.6 — Guard the FCM service worker

**Modified:** `src/lib/push.ts`

The current guard is `'serviceWorker' in navigator`, which is **true** inside a Capacitor WebView. Left alone it registers a useless worker and reports a broken-looking push state. Add `&& !isNative`. The native provider replaces it in Phase 4.

**Landed** as written — `!isNative` leads the condition, with the reasoning kept at the call site so nobody "simplifies" it back out. `usePushRegistration` is untouched: the seam is `window.wiMallGetPushToken`, and P4.1 installs a native provider at the same one.

### P2.7 — Self-host the typefaces

**Modified:** `index.html`

Three families currently load from Google Fonts at boot. A packaged app rendering fallback type on a slow or offline connection looks broken in a way a website does not. Vendor the woff2 files into the bundle and serve `@font-face` locally. Keep the same families — this is not a design change.

**Landed as six files, not twenty-four.** All three families ship as variable
fonts, so one file per family per subset covers every weight with no synthesised
in-betweens: **150 KB total**. A static-weight vendoring of the twelve weights the
`<link>` requested would have been twice that and coarser.

Subsets are **latin + latin-ext only** — complete for en/fr/es/pt. `ar` falls back
to a system face, exactly as it did when these came from Google: none of the three
families ships Arabic glyphs, so nothing regressed.

```
scripts/vendor-fonts.mjs        regenerates both the woff2 files and the CSS
src/assets/fonts/*.woff2        6 files, fingerprinted into the bundle by Vite
src/styles/fonts.css            GENERATED — @import'd first from src/index.css
index.html                      the <link> and both <preconnect>s are gone
```

Verified in `dist/`: six hashed `.woff2` emitted, and no `fonts.googleapis.com` or
`fonts.gstatic.com` reference anywhere in the output.

### P2.8 — Environment profiles

**New:** `env/.env.production`, `env/.env.mobile`

Every configured host today is `localhost`, which on a device means the phone itself. Add a LAN-host dev profile — the Flutter agent app already established this convention with an explicit dev-machine LAN host; mirror it rather than inventing a second pattern.

Add a `build:mobile` script so the native bundle cannot accidentally ship with loopback URLs.

**Landed.** `env/.env.production` already existed; `env/.env.mobile` is new and
holds the LAN-dev profile. Six scripts, split so the two builds can never be
confused for one another:

| Script | Mode | Env file | For |
|---|---|---|---|
| `build:mobile` | `production` | `.env.production` | the bundle that ships |
| `build:mobile:lan` | `mobile` | `.env.mobile` | on-device dev |
| `sync:android` | — | — | `build:mobile` + `cap sync android` |
| `sync:android:lan` | — | — | `build:mobile:lan` + `CAP_LAN_DEV=1 cap sync android` |
| `run:android` | — | — | the LAN sync, then install and launch |
| `open:android` | — | — | Android Studio |

Two things about `--mode` that the env files now state explicitly, because both
are silent failures:

- **Modes do not stack.** `--mode mobile` loads `.env.mobile` and *not*
  `.env.production`, so `.env.mobile` repeats every value it needs.
- **`import.meta.env.DEV` is still `false`** under `--mode mobile`: Vite sets
  `NODE_ENV=production` for every `vite build` regardless of mode. So
  `VITE_FORCE_MOBILE_AUTH` folds away and cannot be set from a mobile build —
  correct, since a native build is already on bearer via `isNative`.

`.env.mobile` deliberately omits `VITE_LOGIN_URL` (dead since Phase 1 put login
in-app), the `VITE_FIREBASE_*` block (web push is off on native per P2.6; native
push is configured by `google-services.json` in P4.1) and the Stripe key
(billing is read-only on mobile, D4). `env/README.md` documents the profile, the
scripts, and the two conditions LAN dev needs — same network, and a backend bound
to `0.0.0.0` rather than `127.0.0.1`.

### P2.9 — App icons and splash

Generate from the existing brand assets in `AppLogos/` and `public/`. Use `@capacitor/assets`. The splash background should be the app's existing `theme-color` (`#0e9f6e`).

**Landed — 87 assets from `assets/logo.png`** (a copy of `AppLogos/appstore.png`,
1024²): launcher icons, adaptive foreground/background, and portrait/landscape
splashes at every density, light and dark.

⚠ **The splash colour deviates from the plan.** `#0e9f6e` is green; the app's
identity is Dispatch Cobalt and the logo itself is cobalt blue, so that splash
would have handed off to a visibly different app. The backgrounds are the app's
own `--background` tokens instead — `#fcfdfe` light, `#080c17` dark — which is
what the plan's parenthetical was reaching for. `index.html`'s `theme-color` is
still the stale green and is worth a separate one-line fix; it drives Chrome's
address bar on web and will drive the native status bar in P3.3.

**A splash-dismiss module was needed to make this safe.** Capacitor's fixed
duration is wrong in both directions, so `src/platform/shell/splash.ts` hides the
splash on the second `requestAnimationFrame` after `createRoot().render()` — the
first fires before React's initial commit is painted. `launchAutoHide` stays
**on** at 2s as a backstop rather than off: if the bundle throws before
`main.tsx` runs, the explicit hide never happens, and with auto-hide off that is
an app permanently stuck behind its own logo — the one failure mode a user cannot
escape.

### Phase 2 exit criteria

- [x] `npm run sync:android && cd android && ./gradlew assembleDebug` →
      **BUILD SUCCESSFUL**, `app-debug.apk` at 6.2 MB (303 tasks, 7m53s cold).
      7 Capacitor plugins detected and linked. *Running* it on hardware is the
      part still outstanding.
- [x] Both env profiles verified end to end in the artefacts they produce:
      `sync:android` bakes `allowMixedContent: false` and
      `https://api.wi-mall.com/api`; `sync:android:lan` bakes
      `allowMixedContent: true` and the LAN address. The cleartext permission
      appears in the merged **debug** manifest and nowhere in
      `src/main/AndroidManifest.xml`.
- [ ] Login succeeds on a physical device against the LAN backend — **blocked by
      D2.** Nothing native can reach the API until `https://agency.wi-mall.internal`
      is in `ALLOWED_ORIGINS`.
- [ ] Tokens survive a force-quit and relaunch
- [ ] A session left idle past 15 minutes refreshes without a visible interruption
- [ ] Backgrounding for >15 minutes and resuming refreshes on resume, not on next 401
- [ ] Uploads work on device
- [x] The web build is unchanged in behaviour — `npm run build` is clean, and the
      only web-visible diffs are the fonts moving from a `<link>` into the bundle
      (P2.7) and a splash-hide call that no-ops off native (P2.9).
- [x] `npm run lint` reports **no new problems**: 25 problems, of which the 20
      errors are exactly the pre-existing `react-refresh/only-export-components`
      set Phase 1 documented. None is in a file Phase 2 touched.
      `eslint.config.js` gained `android` alongside `dist` in `globalIgnores` —
      without it the count moved on every `cap sync`, because ESLint was reading
      the copied web bundle, Capacitor's `native-bridge.js` and Gradle's
      intermediates, which destroys the only thing this command is for.
- [x] Unit tests pass: **93** across four files — the fourth,
      `refreshScheduler.test.ts`, is the P1.12 file that was deferred to this
      phase. It runs under jsdom (the module needs `window` and `document`);
      the other three stay on the node environment.

**The two device-only criteria that unit tests already cover as far as they can:**
idle-past-expiry and resume-after-suspension are both exercised in
`refreshScheduler.test.ts` with fake timers, including the single-flight
guarantee, the 429 backoff, and the clock-skew spin guard. What is left to prove
on hardware is that Keystore persistence survives a force-quit and that the
resume signal actually fires — neither of which is testable off-device.

### Found while doing Phase 2, not fixed by it

**`vite.config.ts` sets `base: './'`, and the app uses `BrowserRouter`.** Every
asset URL in `index.html` is therefore relative (`./assets/index-*.js`). Load the
document at the root and that is fine — which is why a launch, a force-quit and
a relaunch are all unaffected, and why nothing here blocks Phase 2. But serve
`index.html` at a *deep* path and those URLs resolve against that path:
`/dashboard/shipments` asks for `/dashboard/assets/index-*.js` and gets a 404, so
the page loads blank.

This is not a Capacitor problem — **a hard refresh on any deep route of the web
deploy has the same fault today**, wherever the host does SPA fallback. The
WebView just adds one more way to hit it (a process restart can reload at the
current route). The fix is `base: '/'`, which changes the web bundle's asset URLs
and so belongs with a deploy check rather than inside this phase.

---

# Phase 3 — Native shell behaviour

**Goal:** nothing here is a feature; all of it is visible as quality.
**Branch:** `mobile/phase-3-shell-behaviour`

### P3.1 — Android back button
**New:** `src/platform/shell/backButton.ts` — `@capacitor/app` `backButton` → router history; confirm-to-exit at the stack root. Its absence reads as a broken app.

### P3.2 — Keyboard
**New:** `src/platform/shell/keyboard.ts` — resize policy plus hiding `MobileTabBar` while the keyboard is up. `UnsavedChangesBar` sits in the same band and has the same problem. Verify against the onboarding forms and the ticket composer first — they are the densest.

### P3.3 — Status bar and edge-to-edge
**New:** `src/platform/shell/statusBar.ts` — driven by the *same* theme signal as the existing pre-paint script in `index.html`, so light/dark stay in step. The `env(safe-area-inset-*)` CSS is already in place across 13 components and needs no change.

### P3.4 — Network status
**Modified:** `src/components/layout/PlatformStatus.tsx` — currently a placeholder with a `TODO` naming `navigator.onLine`. `@capacitor/network` makes it honest and gives the tracking socket a reconnect trigger.

### P3.5 — External links
**New:** `src/platform/browser.ts` — every outbound link through `@capacitor/browser`. Currently latent (the Telegram/WhatsApp `window.open` calls are commented out) but must land before those features are switched on, or the shell navigates away with no route back.

### Phase 3 exit criteria

- [ ] Back button navigates; at root it confirms before exiting
- [ ] No fixed bar is ever covered by the keyboard, in either orientation
- [ ] Status bar matches the theme, including a mid-session theme switch
- [ ] Airplane mode shows an honest offline state and recovers on reconnect
- [ ] No link can strand the user outside the app

---

# Phase 4 — Native capabilities

**Goal:** the five capabilities already used through browser APIs get native implementations behind their existing call sites.
**Branch:** `mobile/phase-4-capabilities`

### P4.1 — Push notifications
**New:** `src/platform/push.ts` — installs a native provider into the **existing** `window.wiMallGetPushToken` seam that `usePushRegistration` already consumes. No hook changes.

- `@capacitor/push-notifications`, registered with `platform: 'android' | 'ios'` (D5)
- `google-services.json` from the **messaging** Firebase project — which is a different project from file storage. Getting this wrong produces a token that registers fine and never delivers.
- Permission is requested when the user enables push in settings. Never at startup.
- Move the cached token out of `localStorage` into native storage.
- Unregister the token **before** clearing credentials on logout — the `DELETE /agency/devices` call needs the token it is about to discard.

### P4.2 — Deep links
**New:** `src/platform/shell/deepLinks.ts`

Backend notifications carry `action.path` (e.g. `stock-requests/{id}`), and `App.tsx` already resolves those paths — nothing currently routes them *into* the app. Both `appUrlOpen` and the push-tap handler funnel into one `navigate()`. Needs Android intent filters. **Half the value of push depends on this**; shipping P4.1 without it delivers notifications that go nowhere.

### P4.3 — Camera and photo library
**New:** `src/platform/media.ts`

`@capacitor/camera` for a camera-first sheet, with the result converted to a `File` so the existing FormData path, per-type size caps, and video/non-video endpoint splitting in `files.service.ts` are all reused unchanged. Call sites: `MediaLibrary`, `MediaPickerTrigger`.

Handle denied, restricted, and permanently-denied distinctly — permanently-denied needs a route to system settings, not a retry button.

### P4.4 — Geolocation
**New:** `src/platform/geolocation.ts` — `@capacitor/geolocation` behind the "use my location" action in `AddressSearchInput`. Permission on tap. The denied path already exists and shows a toast.

### P4.5 — Clipboard
**New:** `src/platform/clipboard.ts` — `@capacitor/clipboard` for `ChannelSetupDialog`. `navigator.clipboard` is unreliable in WebViews.

### P4.6 — Live tracking
**New:** `src/platform/accessToken.ts` — implements the **existing** `window.wiMallGetAccessToken` seam, which returns null today. `geo-tracker.service.ts` and `useGeoTrackerSocket.ts` already consume it; the socket already supports a `['bearer', token]` subprotocol. Also set `credentials: 'omit'` on native in `geo-tracker.service.ts`.

**Then the reconnect cadence.** geo-tracker re-checks the *handshake* token on shipment lifecycle events. When that token has aged out, the subscription is dropped with `permission_revoked` and `reason: "shipment_completed"` — **which is misleading; the shipment may be fine.** Do not trust that reason string. Reconnect the socket with a fresh access token on a cadence under the 15-minute access TTL; reconnecting is cheap because the session resumes.

### Phase 4 exit criteria

- [ ] A push arrives on a physical device and its tap opens the correct screen
- [ ] Disabling push in settings stops delivery and unregisters server-side
- [ ] Camera and library both produce uploads; a permanently-denied permission routes to settings
- [ ] "Use my location" fills an address
- [ ] The live map streams positions for >20 minutes without losing its subscription

---

# Phase 5 — Billing read-only on mobile (D4)

**Branch:** `mobile/phase-5-billing`

- Gate plan upgrades and credit top-ups behind `!isNative`; on native show plan status, invoices, and transactions with a clear route to complete a purchase on the web dashboard.
- This removes the Stripe redirect problem rather than solving it: `PaymentDialog.tsx:395` sets `return_url` to `window.location.href`, which under a `capacitor://` origin has nowhere to return to. With purchase off the native path, the code stays untouched and unreachable.
- Copy matters here. "Manage your plan on the web dashboard" is a fact; anything that reads as a workaround invites a reviewer to look harder.
- Keep the whole billing *view* — hiding it would be a worse app for no policy benefit.

---

# Phase 6 — iOS

**Blocked by:** access to a Mac or a CI runner with Xcode. The development machine is Windows, so this is a separately-scheduled track, not a same-sprint afterthought.

- `npx cap add ios`, commit `ios/`
- APNs key on the messaging Firebase project; `GoogleService-Info.plist`
- Associated domains for deep links (P4.2's iOS half)
- Verify safe areas on a notched device and on a Dynamic Island device — the CSS is written but has never been seen on hardware
- iOS WebView keyboard behaviour differs from Android's; re-verify P3.2 rather than assuming it carries

---

# Phase 7 — Release

- Signing keys, Play Console listing, privacy declarations
- **Permission justification strings** for both stores. Each of camera, photos, location, and notifications needs a reason string that matches what the app actually does — write these from the real call sites, not from a template.
- Crash and error reporting decision
- Update-path plan: Capacitor serves a bundled build, so a JS-only fix still requires a store release unless live updates are adopted. Decide now whether that is acceptable.
- Update `CLAUDE.md` with the mobile architecture, the platform-layer rule, and the two build commands

---

## Backend / ops tickets

| Ticket | Owner | Blocks |
|---|---|---|
| Add `https://agency.wi-mall.internal` and `capacitor://agency.wi-mall.internal` to `ALLOWED_ORIGINS` on **wi-mall** | Backend | Phase 2 |
| Same two origins on **geo-tracker** (same variable, no separate WebSocket knob) | Backend | Phase 4 |
| Confirm `POST /api/agency/devices` accepts `platform: 'android' \| 'ios'` (D5) | Backend | Phase 4 |
| ~~Confirm the final hostname string before the CORS ticket is filed~~ | Us → Backend | **settled** |

**The hostname is now fixed in code** as `agency.wi-mall.internal`
(`capacitor.config.ts`), which makes the two origins above final. The first
ticket is the remaining hard blocker on Phase 2's device criteria: everything on
the client side is built and the APK assembles, but no request can succeed until
those origins are allowed.

Name the environments explicitly in the ticket. The backend has asked which ones they need it on.

## File inventory

**New — platform layer (the only place Capacitor is imported)**

```
src/platform/env.ts · auth/{strategy,tokens,tokenStore,secureTokenStore,refreshScheduler}.ts
              push.ts · accessToken.ts · media.ts · geolocation.ts · clipboard.ts
              network.ts · browser.ts
              shell/{splash,backButton,deepLinks,keyboard,statusBar}.ts
```

`auth/tokens.ts` and `shell/splash.ts` are Phase 2 additions the plan did not
foresee — see P2.4 and P2.9 for why each exists.

**New — screens (the only new UI in the project)**

```
src/pages/{Login,Register,ForgotPassword}.tsx
```

**Modified**

```
src/services/api.ts             strategy injection, terminal-code table
src/services/files.service.ts   XHR auth headers
src/services/auth.service.ts    login/register/forgot/reset, token capture
src/services/geo-tracker.service.ts  bearer on native
src/lib/push.ts                 native guard
src/App.tsx                     public auth routes, remove the localhost redirect
src/onboarding/store/onboarding.store.tsx  token capture on auth-me
src/components/layout/PlatformStatus.tsx   real network source
index.html                      self-hosted fonts
```

**New — root**

```
capacitor.config.ts · android/ · ios/ · env/.env.production · env/.env.mobile
assets/{logo,logo-dark}.png            source images for @capacitor/assets
scripts/vendor-fonts.mjs               regenerates src/styles/fonts.css (P2.7)
android/app/src/debug/AndroidManifest.xml   debug-only cleartext (P2.8)
```

⚠ `/scripts` is in the root `.gitignore`, so `scripts/vendor-fonts.mjs` will not
be committed — the same pre-existing situation as `scripts/i18n-audit.mjs`, which
`package.json` also references. Worth un-ignoring; not a Phase 2 change.

## Rollback posture

Phases 1 and 5 touch shared code and ship to web; everything else is native-only or behind `isNative`. If a phase needs reverting, Phase 1 is the only one where a revert affects web users — which is why its exit criteria demand the full web sweep in both modes before merge.
