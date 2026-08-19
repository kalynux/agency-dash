# Capacitor Implementation Plan — Agency Dashboard

**Status:** Phases 1–5 code complete (P1.1–P1.12, P2.1–P2.9, P3.1–P3.5,
P4.1–P4.6, P5.1–P5.3). Everything verifiable off a device is verified — build,
lint, 183 unit tests, an assembling APK with 12 plugins linked (Phase 5 is
JavaScript only and links no new plugin). Every remaining exit criterion needs
hardware, and all of them sit behind D2; see the checklists at the end of each
phase.

Phase 4 also needs one artefact nobody can generate from this repo:
`android/app/google-services.json` from the **messaging** Firebase project. The
build succeeds without it — Capacitor's template applies the Google Services
plugin only if the file is present — and push is the only thing that does not
work until it lands.
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
**Status:** code complete (P3.1–P3.5). Everything off-device is verified — build,
lint, 116 unit tests, the APK assembles. The five exit criteria are all
device-only and stay unchecked; they are also all still behind D2, since a shell
that cannot reach the API cannot be driven far enough to judge.

### P3.1 — Android back button
**New:** `src/platform/shell/backButton.ts` — `@capacitor/app` `backButton` → router history; confirm-to-exit at the stack root. Its absence reads as a broken app.

**Landed**, with a third branch the plan did not name and that turned out to
matter more than either of the two it did.

*An open sheet has to absorb the press.* Radix dismisses on **Escape**, which is
a keyboard event a hardware button never produces — so the plan's two-branch
handler would have navigated the page out from underneath an open dialog while
the dialog stayed on screen. `dismissTopLayer()` synthesises the keypress
instead of reaching for each component's `onOpenChange`: Radix's dismissable-layer
stack already knows which layer is topmost, which nest, and which have opted out,
and re-deriving that from the DOM would be a second, worse copy of it that every
future overlay would have to register with.

*The selector is the whole risk.* `data-state="open"` is also on Accordion,
Collapsible and Tabs triggers, so matching it alone would mean one expanded
section on a page swallows **every** back press and the button simply stops
working. It is qualified by `role="dialog"`/`role="alertdialog"`, the Radix
popper wrapper, and vaul's drawer attribute. That is the single case
`backButton.test.ts` spends the most assertions on.

*`canGoBack` is trusted as the root signal.* Every route change in this app is a
pushState on one document, so the WebView's own answer is false exactly when the
user is on the entry they launched into — no parallel depth counter to drift.

*Exit is two presses inside 2s*, prompted through a toast at the app's normal
position rather than the bottom-centre an Android Toast would use: bottom-centre
lands squarely on the tab bar, covering the navigation at the moment the user is
deciding whether to navigate.

### P3.2 — Keyboard
**New:** `src/platform/shell/keyboard.ts` — resize policy plus hiding `MobileTabBar` while the keyboard is up. `UnsavedChangesBar` sits in the same band and has the same problem. Verify against the onboarding forms and the ticket composer first — they are the densest.

**Landed, and the resize half needed no code at all on Android.** Capacitor 8's
built-in `SystemBars` already applies the IME inset as padding on the WebView's
container *and* zeroes the bottom safe-area inset while the keyboard is up — so
`fixed bottom-0` and `env(safe-area-inset-bottom)` both stay honest without
being told. Every resize method on `@capacitor/keyboard` (`setResizeMode`,
`setScroll`, `setStyle`, `setAccessoryBarVisible`) is **iOS-only**, including the
`resize` key in `capacitor.config.ts`; iOS is configured explicitly in
`initKeyboard()` and Android deliberately is not.

*What did need code is the fixed bars*, which resizing does not help: a resized
WebView re-pins `MobileTabBar` faithfully on top of the keyboard, a row of
navigation buttons wedged between the field being typed into and the keys. Three
consumers now read `useKeyboardOpen()` — the tab bar hides its `<nav>` (keeping
its drawers mounted, or focusing a field inside an open sheet would close the
sheet), `UnsavedChangesBar` drops to `bottom-4`, and the shell's `pb` allowance
for the tab bar collapses with it.

*The onboarding CTA and the ticket composer both turned out to need nothing* —
the CTA is in flow at the bottom of a `min-h-screen` flex column and simply rides
the resize, and the composer's actions live in a `ResponsiveModal` footer that
already carried the bottom inset. The CTA gained the inset it was missing for
the gesture bar (P3.3), not for the keyboard.

*The browser fall-back is `false`, always.* `visualViewport` could synthesise the
signal in a mobile browser, but it would be a behaviour change to a shipping
surface for a problem browsers do not have: they resize the visual viewport and
leave the layout viewport alone, so a fixed bar stays put rather than riding the
keyboard.

### P3.3 — Status bar and edge-to-edge
**New:** `src/platform/shell/statusBar.ts` — driven by the *same* theme signal as the existing pre-paint script in `index.html`, so light/dark stay in step. The `env(safe-area-inset-*)` CSS is already in place across 13 components and needs no change.

**Landed, but the last sentence was wrong** and it was the most consequential
thing this phase found.

⚠ **The CSS was in place for the *bottom* inset only.** Of the thirteen call
sites, exactly one — `AuthShell` — reserved `env(safe-area-inset-top)`, and it is
a screen that did not exist before Phase 1. The shell draws edge to edge on every
Android version this targets (the platform enforces it from 15; on older ones
`@capacitor/status-bar` opts in by default), so the dashboard's content column,
the onboarding header and the toaster were all being laid out underneath the
clock and the battery. Four small additions fix it, all of them `env()`
expressions that resolve to 0 in every browser:

```
src/App.tsx                    <main> gains pt-[calc(1.5rem+env(safe-area-inset-top))] on mobile
src/onboarding/OnboardingLayout.tsx   the header fills the band with its own white; the mobile CTA clears the gesture bar
src/App.tsx                    Toaster offset/mobileOffset = sonner's own defaults + the top inset
```

`MobilePageHeader` — the one component with a `sticky top-0` bar that would have
needed its own treatment — turns out to have **no importers at all**, so it was
left alone rather than fixed speculatively.

*`SystemBars`, not `@capacitor/status-bar`, drives the styling.* Capacitor 8
promotes it to a core plugin exported from `@capacitor/core`, and it covers
**both** bars; `@capacitor/status-bar` only ever touches the top one, so on a
light theme over a dark OS the gesture bar would keep white-on-white icons. The
style is nonetheless pushed into *both* plugins, which is not redundant:
`@capacitor/status-bar` caches the last style it was given and re-applies it on
every configuration change, so left holding its default it would re-apply the
**system's** theme on the next rotation and quietly undo ours.

*The theme signal is the `.dark` class on `<html>`*, watched with a
`MutationObserver` rather than subscribed from `useUIStore`. That is the same
class the pre-paint script writes, so the bars are right in the first painted
frame — before React mounts — and stay right through a manual switch, an OS
switch under `system`, and any future writer. There is no second source of truth
to drift from.

*Two calls the plan implies but that must NOT be made:* `setOverlaysWebView` and
`setBackgroundColor` are documented as unavailable on Android 15+, and this app
targets SDK 36. Overlay is already the default and the status bar is already
transparent; calling either would do nothing on a modern device and something
inconsistent on an old one.

`index.html`'s stale green `theme-color` (flagged in P2.9) is fixed here as the
one-line change it was: two `prefers-color-scheme` metas carrying the same
`#fcfdfe` / `#080c17` the splash uses.

### P3.4 — Network status
**Modified:** `src/components/layout/PlatformStatus.tsx` — currently a placeholder with a `TODO` naming `navigator.onLine`. `@capacitor/network` makes it honest and gives the tracking socket a reconnect trigger.

**Landed as `src/platform/network.ts`**, plus one component the plan did not
anticipate needing.

⚠ **`PlatformStatus` renders only inside `Sidebar`, and the sidebar is not
rendered below 768px** — which is every phone this is being packaged for. Making
it honest fixes the desktop and leaves the mobile build with no offline state at
all, which is the surface the exit criterion is actually about. So
`OfflineBanner` was added: a bar across the top of the app, above the routes, for
as long as the device has no network. Above the routes on purpose — a failed
sign-in on a phone with no signal is exactly the moment the user most needs to be
told it is the network and not their password.

*`'degraded'` stays unreachable and stays in the union.* It is the honest label
for "connected, but the API is not answering", and nothing measures that yet —
that needs a health ping, which is its own decision about how often to spend a
request saying nothing is wrong. `'offline'` no longer maps to
`platformStatus.down` ("Service disruption"), which pointed the finger at the
platform for what is almost always a phone in a lift.

*The socket trigger is an edge, not a level.* `subscribeNetworkRestored()` fires
only on the offline → online transition, and `useGeoTrackerSocket` uses it to
skip the rest of its backoff — up to 30s of a live map showing stale pins on a
phone that came back to signal ten seconds ago. Guarded on an already-open
socket, because the OS reports a *network* change and not a socket one: moving
from cellular to Wi-Fi fires it while the existing connection is perfectly fine.

*What `navigator.onLine` actually answers*, since the web build now shows a
banner on it: whether a network interface is up, not whether the internet is
reachable. It is honest about airplane mode — the case the exit criterion names —
and optimistic about a captive portal. So `connected === false` is treated as
proof and `connected === true` as an absence of proof: nothing here signs anyone
out, cancels a request, or blocks a form.

### P3.5 — External links
**New:** `src/platform/browser.ts` — every outbound link through `@capacitor/browser`. Currently latent (the Telegram/WhatsApp `window.open` calls are commented out) but must land before those features are switched on, or the shell navigates away with no route back.

**Landed as two entry points, because outbound links arrive two ways.**
`openExternal()` for code, and a capture-phase click interceptor for markup —
which is what reaches the `<a target="_blank">` that `LiveTrackingMap` injects
into a Leaflet popup as an **HTML string**, where no component-level fix could
have gone. The interceptor covers the other four anchor call sites
(`ChannelSetupDialog` ×2, `PoliciesSettings`, `AttachmentsPanel`, `MediaLibrary`)
without touching any of them.

*The predicate compares protocol + host, never `origin`.* Under iOS the document
scheme is `capacitor:`, which `URL` does not treat as special, so
`new URL('/dashboard', location.href).origin` is the string `"null"` — an origin
comparison would classify every in-app route as external and hand the whole app
to Safari. `browser.test.ts` pins this.

*Non-http schemes are deliberately left alone.* `mailto:`, `tel:` and `intent:`
are already routed to the system by Capacitor's own `WebViewClient`, which is the
correct destination, and `Browser.open` cannot load any of them.

*`window.open` is not monkey-patched.* It would have been a tidy safety net for
the two commented-out call sites, but callers that dereference the returned
`Window` (Stripe's hosted script among them) would get `null` from a patch that
cannot return one. Both disabled files carry a note at the top instead, naming
`openExternal` as what the line has to become when the channel is switched on.

### Phase 3 exit criteria

- [ ] Back button navigates; at root it confirms before exiting
- [ ] No fixed bar is ever covered by the keyboard, in either orientation
- [ ] Status bar matches the theme, including a mid-session theme switch
- [ ] Airplane mode shows an honest offline state and recovers on reconnect
- [ ] No link can strand the user outside the app
- [x] `npm run build` clean; `npm run sync:android && ./gradlew assembleDebug` →
      **BUILD SUCCESSFUL**, 7 plugins linked
- [x] `npm run lint` reports **no new problems** — 25 problems, the same
      20 `react-refresh/only-export-components` errors plus 5 warnings Phases 1
      and 2 documented, none in a file this phase touched. (`react-hooks/refs`
      caught a ref written during render in `backButton.ts` and it was fixed
      rather than suppressed.)
- [x] Unit tests pass: **116** across seven files — 23 new, in
      `platform/network.test.ts`, `platform/browser.test.ts` and
      `platform/shell/backButton.test.ts`
- [x] `npm run i18n:check` exits 0; French stays at 100%. Three new `nav` keys,
      written in all five locales.

**All five behavioural criteria need hardware**, and all five are also still
behind D2: the shell has to reach the API before there is enough app to drive a
back stack, a keyboard or a link through. The unit tests cover as far as logic
can go — the overlay selector, the restore edge, the interception predicate —
and stop exactly where the plugins begin.

**`npm run run:android` defeated its own LAN setup, found in Phase 5.** It ran
`sync:android:lan` (with `CAP_LAN_DEV=1`) and then a bare `cap run android` —
and `cap run` re-syncs before deploying, so the second sync rewrote
`capacitor.config.json` with `allowMixedContent: false`. Every `http://` call to
the dev backend was then dropped by the WebView before reaching the network,
which is indistinguishable from the backend being down. The script now sets the
variable on `cap run` itself and syncs once.

### Found while doing Phase 3, not fixed by it

**The offline banner covers the chrome it sits over.** It is `fixed top-0 z-50`,
above the desktop `Header` (`sticky top-0 z-30`) and the top of the `Sidebar`
(`z-40`). Full-width-at-the-top is the conventional shape for this and the
alternative — putting it in flow — pushes every `min-h-screen` shell past the
viewport and grows a scrollbar on every screen for the duration of an outage. The
header's search and notification bell are not usable offline anyway. Worth
revisiting only if the outage state turns out to be long-lived in practice.

**The web build gains one visible behaviour**, deliberately: it now shows the
offline banner and a red platform-status dot when `navigator.onLine` is false,
where before it showed a green "All systems operational" dot in airplane mode.
That is the P3.4 fix, not a side effect — but it is the only Phase 3 change a
browser user can see, alongside the `theme-color` tint. Everything else resolves
to `env(…) = 0` or to a listener that is never installed off native.

**`dist/` is tracked in git**, so a build shows up as a source change
(`dist/index.html` moved with `index.html` here). Same family as the
`node_modules` accident P2.1 found, same answer: its own commit, its own
decision.

---

# Phase 4 — Native capabilities

**Goal:** the five capabilities already used through browser APIs get native implementations behind their existing call sites.
**Branch:** `mobile/phase-4-capabilities`
**Status:** code complete (P4.1–P4.6). Build, lint, 176 unit tests and the APK
are all clean. Four plugins were added, plus one the plan did not anticipate
(`capacitor-native-settings` — see P4.3). The five exit criteria are device-only
and stay unchecked; push additionally needs `google-services.json`.

### P4.1 — Push notifications
**New:** `src/platform/push.ts` — installs a native provider into the **existing** `window.wiMallGetPushToken` seam that `usePushRegistration` already consumes. No hook changes.

- `@capacitor/push-notifications`, registered with `platform: 'android' | 'ios'` (D5)
- `google-services.json` from the **messaging** Firebase project — which is a different project from file storage. Getting this wrong produces a token that registers fine and never delivers.
- Permission is requested when the user enables push in settings. Never at startup.
- Move the cached token out of `localStorage` into native storage.
- Unregister the token **before** clearing credentials on logout — the `DELETE /agency/devices` call needs the token it is about to discard.

**Landed.** The seam took the native provider exactly as designed. Everything
else in the bullet list above turned out to live in the hook.

⚠ **"No hook changes" was half right, and the wrong half was load-bearing.**
The *token* needs none — `platform/push.ts` fills the same
`window.wiMallGetPushToken` that `lib/push.ts` fills on web, and
`usePushRegistration` cannot tell them apart. But everything the hook did
*around* the token was browser API:

- `'Notification' in window` is **false in an Android WebView** — the
  Notifications API is not implemented there. Unmodified, the hook reports
  `'unsupported'` and the settings screen offers no way to turn push on at all,
  on the one platform this phase is for.
- `Notification.permission` / `requestPermission()` likewise do not exist;
  Android 13+ has its own `POST_NOTIFICATIONS` runtime grant.
- `platform: 'web'` was hardcoded at the registration call — and it is not
  cosmetic, it picks which credential the sender signs with (D5).
- the token was cached in `localStorage`, which the plan explicitly moves.

So four things moved behind `platform/push.ts` — support, permission, device
platform, token cache — each falling back to precisely the old browser code when
`isNative` is false, down to the `agency:pushToken` storage key. The web path is
unchanged; the hook is now honest on both.

*The token cache is in the Keystore, not `@capacitor/preferences`.* A push token
is not a credential the way a refresh token is — it authorises delivery *to* this
device, not action *as* this user — but it is a durable device identifier, WebView
`localStorage` is world-readable on a rooted device, and `@aparajita/capacitor
-secure-storage` was already linked for P2.4. There was no reason to reach for
something weaker.

*A deadline on the token, which the plan did not call for.* `register()` resolves
as soon as the *request* is made; the token arrives later on the `registration`
event, or never — no Play Services, no network, no `google-services.json` all
look identical from JS. Without the 15s cap the settings screen spins forever on
a case that is not rare.

**A rotation path the plan did not name, and the backend cannot see.** FCM
rotates tokens on its own schedule — a restore onto a new device, a data clear —
and the backend then holds a token that **accepts every send and delivers
nothing**. That is indistinguishable from push being broken, and nothing in the
original design would ever have noticed. So the `registration` listeners are
attached at module load rather than on first use (a rotation refreshed while the
app was closed is delivered shortly after the next launch, when no settings
screen is open), and **every** token is announced rather than only one that
changed within the launch — the in-memory value starts null on a cold start, so
comparing against it would classify exactly the important case as first sight.
`usePushRegistration` compares against what it actually registered, which is the
only copy that matters, and re-registers when they differ.

**New:** `src/lib/pushDevice.ts`, because the ordering has two callers.
`src/platform/` deliberately calls no services and `src/services/` knows nothing
about a device, but both `usePushRegistration` and `authService.logout()` need
*talk to the backend, then update the cache* done in that order — a cached token
the server never saw shows the settings screen as registered while nothing is
ever delivered. `logout()` now awaits `unregisterPushDevice()` **first**, before
`stopRefreshScheduler()` and `endSession()`, since `DELETE /agency/devices`
authenticates with the credential those two destroy.

⚠ **iOS will not work as written, and it is not a bug on this side.**
`@capacitor/push-notifications` wraps **APNs** directly on iOS, so `Token.value`
there is an APNs token, while the backend sends through FCM. Registered as-is it
would be accepted and never deliver — the same silent failure as a rotated token.
Closing it needs Firebase's own iOS messaging SDK to do the APNs→FCM exchange.
Android, which is what this phase ships, is unaffected: that token IS the FCM
token. Tracked against Phase 6, and noted at the call site.

### P4.2 — Deep links
**New:** `src/platform/shell/deepLinks.ts`

Backend notifications carry `action.path` (e.g. `stock-requests/{id}`), and `App.tsx` already resolves those paths — nothing currently routes them *into* the app. Both `appUrlOpen` and the push-tap handler funnel into one `navigate()`. Needs Android intent filters. **Half the value of push depends on this**; shipping P4.1 without it delivers notifications that go nowhere.

**Landed**, with a queue and a two-shape resolver the plan folded into one line.

*The cold-start tap is the normal case, not an edge one.* Tapping a notification
on a phone where the app is not running starts the process, and the plugin
replays the tap as soon as the JS context exists — well before React has mounted
and a router exists to receive it. So the listeners are attached at module scope
and a link that arrives early is **buffered**, then flushed by `useDeepLinks` on
mount. Attached from a React effect instead, the single most important tap in the
feature is the one that gets dropped.

*Two link shapes, two depths, and conflating them is silent.* An App Link
(`https://agency.wi-mall.com/dashboard/shipments/123`) carries a complete app
route in its pathname. Our own scheme (`wiagency://shipments/123`) carries the
dashboard-relative path the notification payload already uses — and `URL` parses
its first segment as the **host**, because a custom scheme has no authority
component, so host and pathname have to be recombined *and* still need
`/dashboard` in front. One rule for both produces either `/dashboard/dashboard/…`
or a route missing its prefix; the app opens, navigates somewhere, and the
notification looks like it worked. `deepLinks.test.ts` is mostly this table.

*The origin is never compared.* The WebView serves the app from
`agency.wi-mall.internal` while links are minted against `agency.wi-mall.com`, so
an origin check would reject every real link. The intent filter is what vouched
for the URL before it got here.

*`notificationHref` was split rather than duplicated.* Its dashboard-prefixing
half is now `dashboardRoute(path)` in `lib/notification-display.ts`, which both
the notifications list and the push payload resolve through — one place that
knows `action.path` is dashboard-relative.

**Intent filters** are in `android/app/src/main/AndroidManifest.xml`, and
`launchMode="singleTask"` (already there from the template) is what makes them
arrive as `appUrlOpen` on the running instance instead of stacking a second copy
of the app.

⚠ **The App Link half does not work yet and cannot be made to from here.**
`autoVerify` only takes effect once
`https://agency.wi-mall.com/.well-known/assetlinks.json` names this package and
its signing-certificate fingerprint — which does not exist until Phase 7 mints
the release key. Until then Android silently declines to verify and those links
keep opening the browser. Nothing breaks; the app just does not claim them. The
`wiagency://` scheme needs no server-side proof and is what works today, for the
notification payload and for
`adb shell am start -d wiagency://shipments/<id>`.

*A deep link that lands signed-out survives.* It navigates to the real route,
`OnboardingGuard` holds the render while auth is in flight, and if there is no
session it redirects with `state: { from: location }` — which `Login.tsx` already
reads and returns to after sign-in. Nothing needed adding for that; it is worth
recording that it composes.

### P4.3 — Camera and photo library
**New:** `src/platform/media.ts`

`@capacitor/camera` for a camera-first sheet, with the result converted to a `File` so the existing FormData path, per-type size caps, and video/non-video endpoint splitting in `files.service.ts` are all reused unchanged. Call sites: `MediaLibrary`, `MediaPickerTrigger`.

Handle denied, restricted, and permanently-denied distinctly — permanently-denied needs a route to system settings, not a retry button.

**Landed**, and the conversion is where the sharp edges were.

*The real call sites are `MediaPicker` and `MediaLibrary`.* `MediaPickerTrigger`
only opens `MediaPicker`; the upload UI — a hidden `<input type="file">`, an
Upload button, drag-and-drop — lives in those two, duplicated. Both keep all of
it. The only change is that the Upload button now calls `requestUpload()`, which
opens the source sheet on a device and clicks the same hidden input on the web.

**New:** `src/components/common/UploadSourceSheet.tsx` — the one piece of new UI,
which P4.3 authorises ("a camera-first sheet") against ground rule 1. Three rows
on a `ResponsiveModal`: take photo, photo library, browse files. It owns only the
*choice*; the files it produces go to the same `onPicked` the file input already
feeds, so both screens keep their upload path, validation, progress bar and
layout. A component-only module rather than a hook returning JSX, so it does not
add a `react-refresh/only-export-components` error to a count the exit criteria
track.

*`webPath`, never `uri`.* `uri` is a `file://` path the WebView cannot read
cross-origin; `webPath` is served by Capacitor's own handler on the app origin,
so a plain `fetch` works and the bytes arrive without a base64 round trip through
the bridge.

⚠ **The filename extension is load-bearing, not decoration.**
`validateMediaSelection` and `isVideoUpload` both fall back to the extension when
`File.type` is empty — which is the normal case for `.mov` — so a File named
`image` routes a QuickTime video to `/files/upload`, which rejects video
outright. Names come from the source URI's basename when it has an extension, and
are otherwise synthesised with a real one.

**A precedence bug the tests caught.** The first version preferred `blob.type`
over the plugin's declared `metadata.format`. Capacitor's local file handler
answers from a static extension table and falls back to
`application/octet-stream` for anything it does not know — which `kindFromMime`
reads as a **document**, so a perfectly good photo would be filtered out of an
image-only slot on the way back into `MediaPicker`. The OS's own media metadata
is the better source and now wins.

*Capture quality is 85, not the plugin's default 100.* At 100 a modern phone
sensor produces an 8–12 MB JPEG — over the 10 MB agency image cap (storage.md
§1), so the first photo a user took would be rejected by our own validator.
`saveToGallery` is off: a delivery proof being uploaded is not the user's photo
to keep.

*Only the permission in use is requested.* Asking for the photo library when the
user tapped "Take photo" is how an app teaches people to decline prompts on
principle.

**New dependency the plan did not anticipate: `capacitor-native-settings`.**
"Permanently-denied needs a route to system settings" has no core-plugin answer —
`@capacitor/app` has no `openSettings`, and the alternatives were an undocumented
`intent:` URI trick or a message with no button. It is one small, purpose-built
plugin, used from `src/platform/permissions.ts` and nowhere else.

**New:** `src/platform/permissions.ts`, shared with P4.4. Camera, library and
location fail the same four ways, and Capacitor reports "no, this time" and "no,
and don't ask again" with the *same* `'denied'` string. The distinguishing state
is what `checkPermissions()` said **before** prompting: `'prompt'` or
`'prompt-with-rationale'` means a prompt was just shown and the refusal is
this-time-only; an already-`'denied'` check means nothing was shown and nothing
ever will be. That is the whole difference between a retry button that works and
one that silently does nothing.

### P4.4 — Geolocation
**New:** `src/platform/geolocation.ts` — `@capacitor/geolocation` behind the "use my location" action in `AddressSearchInput`. Permission on tap. The denied path already exists and shows a toast.

**Landed**, and the existing denied path was not the one that mattered.

⚠ **`navigator.geolocation` exists in an Android WebView and never prompts.** It
is bound to the *app's* runtime permission, and a WebView cannot raise an Android
runtime prompt on the app's behalf — so without `ACCESS_FINE_LOCATION` already
granted it fails with `PERMISSION_DENIED` immediately. The old code's toast was
correct and the user had no way to act on it.

*Five outcomes, because they need five different things from the user*: filled,
refused-this-time (retry), refused-for-good (settings, via P4.3's shared
module), no capability at all, and a fix that failed with permission perfectly
fine — indoors, hardware off, timed out. The last was previously indistinguishable
from a refusal.

*Either grant is enough.* Coarse location geocodes to the right neighbourhood, and
refusing to proceed on a permission the user deliberately narrowed would be worse
than an approximate address they can correct.

*The browser branch never reports `'blocked'`.* There is no settings screen we can
open there, so the distinction would only buy a button that cannot exist.

### P4.5 — Clipboard
**New:** `src/platform/clipboard.ts` — `@capacitor/clipboard` for `ChannelSetupDialog`. `navigator.clipboard` is unreliable in WebViews.

**Landed**, and it fixed a latent web bug on the way past. The old call was
`navigator.clipboard.writeText(cmd).then(() => setCopied(true))` — no `catch`, so
a refusal was an unhandled rejection and a "Copied!" state that simply never
arrived. `copyText()` returns whether the copy happened, and the dialog now says
so when it did not, because the whole step depends on the user pasting that
command into WhatsApp.

### P4.6 — Live tracking
**New:** `src/platform/accessToken.ts` — implements the **existing** `window.wiMallGetAccessToken` seam, which returns null today. `geo-tracker.service.ts` and `useGeoTrackerSocket.ts` already consume it; the socket already supports a `['bearer', token]` subprotocol. Also set `credentials: 'omit'` on native in `geo-tracker.service.ts`.

**Then the reconnect cadence.** geo-tracker re-checks the *handshake* token on shipment lifecycle events. When that token has aged out, the subscription is dropped with `permission_revoked` and `reason: "shipment_completed"` — **which is misleading; the shipment may be fine.** Do not trust that reason string. Reconnect the socket with a fresh access token on a cadence under the 15-minute access TTL; reconnecting is cheap because the session resumes.

**Landed.** The seam was the easy half; the cadence found a race.

*The token is refreshed before it is handed out, not just read.* The cost of a
stale token is asymmetric: given to `api.ts` it produces one 401 and one
transparent retry, but given to a **WebSocket handshake** it is captured by
geo-tracker for the life of the connection. So `getAccessToken()` refreshes when
the token is within 60s of expiry, through P2.5's shared single-flight lock —
coalescing onto whatever the scheduler already has in flight rather than racing
it for the refresh token.

⚠ **The re-handshake is NOT gated on the transport, deliberately.** The cookie
build has the identical fault: a browser attaches `access_token` to the handshake
and never again, so a web user watching one delivery for twenty minutes loses the
subscription exactly the same way — and is told `shipment_completed` about a
shipment that is fine. It was always a bug; Phase 4 is only where it got found.
Ten minutes, comfortably under the 900s TTL, and only an already-OPEN socket is
cycled: one that is connecting or sitting in backoff has a fresh handshake coming
already, and interrupting it would restart the backoff it is halfway through.

**A pre-existing race in `reconnect()` that the timer would have started
exercising every ten minutes.** It closed the old socket and called `connect()`,
which `await`s the token before touching any ref — so the old socket's `close`
event could land *after* `connect()` had stored the new socket. Its `onclose`
would then null out `socketRef` (holding the new socket) and schedule another
reconnect on top of the connection just made: two sockets, and a subscription map
describing neither. Manual reconnect fires rarely enough that it was survivable;
on a ten-minute clock it would not have been. The outgoing socket's handlers are
now detached before it is closed, which makes the ordering irrelevant rather than
lucky.

### Phase 4 exit criteria

- [ ] A push arrives on a physical device and its tap opens the correct screen —
      **also blocked on `google-services.json`**, which no code change can supply
- [ ] Disabling push in settings stops delivery and unregisters server-side
- [ ] Camera and library both produce uploads; a permanently-denied permission routes to settings
- [ ] "Use my location" fills an address
- [ ] The live map streams positions for >20 minutes without losing its subscription
- [x] `npm run build` clean; `npm run sync:android && ./gradlew assembleDebug` →
      **BUILD SUCCESSFUL**, `app-debug.apk` at 12.0 MB, **12 plugins** linked
      (7 + camera, clipboard, geolocation, push-notifications, native-settings)
- [x] The merged debug manifest carries all four new runtime permissions, both
      intent filters, and Firebase's `MessagingService`; `usesCleartextTraffic`
      still appears **only** via the debug overlay, and `sync:android` still
      bakes `allowMixedContent: false`
- [x] `npm run lint` reports **no new problems** — 25 problems, the same 20
      `react-refresh/only-export-components` errors plus 5 warnings Phases 1–3
      documented, none in a file this phase touched
- [x] Unit tests pass: **176** across eleven files — 60 new, in
      `platform/push.test.ts`, `platform/media.test.ts`,
      `platform/permissions.test.ts` and `platform/shell/deepLinks.test.ts`
- [x] `npm run i18n:check` exits 0; French stays at 100%. 19 new keys across
      `settings` and `media`, written in en and fr — the only two locales that
      carry those namespaces (ar/es/pt hold `common`, `errors`, `nav` only and
      fall back to en)

**What the unit tests cover and where they stop.** The deep-link resolver table,
the permission-outcome distinction, the `File` conversion (extension, MIME
precedence, cancel/permission error codes) and the push token deadline plus
rotation announcement are all exercised off-device. What is left needs hardware
and a Firebase project: that a push actually arrives, that the camera returns
bytes, that a GPS fix resolves, and that a subscription survives twenty minutes.

### Found while doing Phase 4, not fixed by it

**`google-services.json` is a hard external dependency for P4.1.** The Gradle
side already handles its absence — Capacitor's `android/app/build.gradle` applies
the Google Services plugin inside a `try` that logs and continues — so the build
is green and push is simply inert. It must come from the **messaging** Firebase
project, not the file-storage one; the wrong project yields a token that
registers fine and never delivers, which looks like a client bug for as long as
anyone is willing to look.

**iOS push needs the Firebase messaging SDK, not this plugin alone** (P4.1).
Phase 6.

**App Links need `assetlinks.json` and a release signing key** (P4.2). Phase 7.

**The web build gains two visible behaviours**, both bug fixes rather than
features: the WhatsApp setup dialog now reports a failed copy instead of silently
staying un-copied (P4.5), and the live map re-handshakes every ten minutes
instead of losing its subscription (P4.6). Everything else in this phase is
behind `isNative` or `useBearerAuth`.

---

# Phase 5 — Billing read-only on mobile (D4)

**Branch:** `mobile/phase-5-billing`

**Landed.** The web build is the same app it was this morning: every change is
behind one flag that is `false` in a browser. The plan's four bullets survived
contact intact — the only thing they did not settle is named at the end.

### P5.1 — The gate

**New:** `src/platform/purchases.ts`

```ts
export const purchasesEnabled = !isNative;
export const webDashboardUrl, webBillingUrl, webDashboardHost;
```

A module rather than an inline `!isNative` at three call sites, for the reason
`env.ts` exists: the negation does not carry *why*, and here it is two whys, not
one — store policy **and** the Stripe return trip that a custom-hostname origin
cannot complete. Both are written down once, next to the flag.

**Deliberately `!isNative`, not `!useBearerAuth`.** This is a store-policy and
redirect-topology question, not an auth-transport one, and
`VITE_FORCE_MOBILE_AUTH` has to leave the purchase flow reachable — a desktop
browser is where that flow is developed. The cost is that the gated UI cannot be
eyeballed from `npm run dev`; `purchases.test.ts` imports the module under both
worlds instead, and a LAN build puts it on a device.

**New env var: `VITE_WEB_DASHBOARD_URL`**, defaulting to
`https://agency.wi-mall.com`. `.env.mobile` overrides it to the dev machine's
Vite port, because the production default is a live site in front of a different
backend — on-device the notice would otherwise send you somewhere your test
agency does not exist.

### P5.2 — What stops, and what does not

`BillingTab` is the only place the gate is read. It stops handing
`openPlanPurchase` / `openPackPurchase` down, and never mounts `PaymentDialog`.
`PlansCatalog.onBuy` and `CreditWalletCard.onBuyPack` became optional props —
their absence *is* the gate, so neither component learns what a platform is.

What still renders on a phone, unchanged: the current plan with its shipment
meter and at-capacity nudge, the credit balance, media storage, **every plan in
the catalog with its price and feature list**, **every credit pack with its
price**, **every saved payment method** with its default badge, "set as
default" and "remove", the expiry-reminder setting, and the whole transaction
history. The catalog loses only its per-plan button — and loses it entirely
rather than disabling it, because a greyed-out "Choose plan" reads as something
broken rather than as something that lives elsewhere. The two status pills stay:
"Your plan" and "Default tier" are labels, not actions.

**Adding a payment method goes with the purchases**, which is one step past
D4's literal wording and was decided after the first pass. Managing an
instrument that already exists is not a purchase — and being unable to delete a
card from the device in your hand would be a worse app, not a safer one — but a
card *form* in a build that cannot take a payment is a question a reviewer will
ask, and the only honest answer is "so you can pay on the web". The notice says
that without collecting a card number first. `AddPaymentMethodDialog` is not
mounted at all on native, so the whole Stripe card field goes with it.

`PaymentDialog.tsx`, `StripePaymentElement.tsx`, `StripeCardField.tsx` and
`billing.constants.ts` are untouched, exactly as the plan asked. The one line
that acknowledges them is in `BillingTab`'s 3-D Secure resume effect, which now
returns early on native: a build that cannot start a payment cannot have one to
come back to, and polling `verify` five times for a marker that can never exist
is not free.

### P5.3 — The notice

**New:** `src/components/billing/ManageOnWebNotice.tsx` — one component, three
strings, rendered under the plan catalog, under the credit packs, and under the
saved-method list: exactly where each button was. An empty method list shows it
*instead of* the "add one to speed up checkout" copy, which would otherwise be a
dead end.

The copy names the host so the destination is checkable ("Manage your plan on the
web dashboard at agency.wi-mall.com") and then stops. No apology, no
"unfortunately", no urgency. Anything that reads as a workaround for a store rule
invites a reviewer to look harder at the rule.

The link goes through `openExternal` (P3.5), so it opens a Custom Tab over the
still-running app rather than navigating the WebView somewhere it has no way back
from.

### Phase 5 exit criteria

- [x] `npm run build` clean
- [x] `npm run lint` reports **no new problems** — the same 25 Phases 1–4
      documented, none in a file this phase touched
- [x] Unit tests pass: **183** across twelve files — 7 new, in
      `platform/purchases.test.ts`, covering both sides of the gate, the
      `VITE_FORCE_MOBILE_AUTH` exemption, and the URL derivation
- [x] `npm run i18n:check` exits 0; French stays at 100%. 4 new keys under
      `billing.web`, written in en and fr
- [x] `git diff` shows **no change** to `PaymentDialog.tsx`,
      `StripePaymentElement.tsx`, `StripeCardField.tsx`,
      `AddPaymentMethodDialog.tsx` or `billing.constants.ts` — all four are
      unreachable on native, none of them edited
- [x] `npm run sync:android && ./gradlew assembleDebug` → **BUILD SUCCESSFUL**,
      `app-debug.apk` at 13 MB carrying this bundle, the **same 12 plugins** as
      Phase 4. Phase 5 is JavaScript only; it links nothing new and touches no
      native source
- [ ] On a device: the billing page renders in full, no card offers a purchase
      button, and the notice's link opens the web dashboard in a Custom Tab —
      behind the CORS ticket like every other device criterion

### Found while doing Phase 5, not fixed by it

**D4's three statements of scope name two flows; the code gates three.** The
decision row, this phase's first bullet, and the note already sitting in
`env/.env.mobile` each say "plan upgrades and credit top-ups". Adding a payment
method is neither, and it works fine on native — the form tokenises in-page with
no redirect. It is gated anyway, on the heading rather than the bullets, because
"read-only" is what the decision is called and a card form is not read-only. If
that is wrong, it is wrong in a way that costs an agency one trip to the web to
save a card, and `purchasesEnabled` in `SavedPaymentMethodsCard` is the single
line that reverses it. Worth knowing either way: neither `.env.mobile` nor
`.env.production` ships a Stripe key today, so that dialog offered mobile money
only on a native build regardless.

**The web dashboard will ask for a second login.** Native holds bearer tokens the
Custom Tab knows nothing about, so an agency that follows the notice signs in
again on the web. Closing that needs a one-time-token handoff, which is a backend
feature; the notice promises nothing else, and it is the same trip a user makes
today from any second device.

**`.env.mobile` now carries a second address that drifts.**
`VITE_WEB_DASHBOARD_URL` has to track the same DHCP lease as
`VITE_API_BASE_URL`; on a machine whose address has moved, both belong in
`env/.env.mobile.local`.

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
| ~~Confirm `POST /api/agency/devices` accepts `platform: 'android' \| 'ios'` (D5)~~ | Backend | **settled** |
| `google-services.json` from the **messaging** Firebase project | Ops | Phase 4 push |
| Confirm the FCM `data` payload carries `path` (or `url`) for deep links | Backend | Phase 4 push |
| `assetlinks.json` on `agency.wi-mall.com`, once the release key exists | Ops | App Links (P4.2) |
| ~~Confirm the final hostname string before the CORS ticket is filed~~ | Us → Backend | **settled** |

**D5 is settled in the code already**: `DevicePlatform` in
`src/types/notification.types.ts` is `'web' | 'android' | 'ios'`, which is the
frontend's copy of the backend contract, so the value P4.1 now sends was already
the documented one. Worth one confirming message, not a ticket.

**The deep-link payload is the one genuinely open question.**
`routeFromPushData` reads `path` (or `action_path`, or a fully-qualified `url`)
because that mirrors `AgencyNotificationAction`, which is what the in-app
notification carries. If the FCM `data` payload names those fields differently,
every push opens the dashboard root instead of the screen it is about — and it
will look like a client bug. One message resolves it; the resolver is a
three-line change either way.

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
              network.ts · browser.ts · permissions.ts · purchases.ts
              shell/{splash,backButton,deepLinks,keyboard,statusBar}.ts
```

`auth/tokens.ts` and `shell/splash.ts` are Phase 2 additions the plan did not
foresee — see P2.4 and P2.9 for why each exists. `permissions.ts` is the Phase 4
equivalent: camera, photo library and location all need the same
denied-vs-permanently-denied distinction, and it is the only module that imports
`capacitor-native-settings`. See P4.3. `purchases.ts` is Phase 5's — the only
module here that imports no plugin at all, because what it answers is a policy
question rather than a capability one. See P5.1.

Everything above now exists.

**New — screens (the only new UI in the project)**

```
src/pages/{Login,Register,ForgotPassword}.tsx
src/components/layout/OfflineBanner.tsx      the mobile half of P3.4 — see there
src/components/common/UploadSourceSheet.tsx  the camera-first sheet (P4.3)
src/components/billing/ManageOnWebNotice.tsx what stands where a purchase
                                             button was (P5.3)
```

**New — policy**

```
src/lib/pushDevice.ts    register/unregister ordering, shared by the settings
                         hook and by logout (P4.1)
```

**Modified**

```
src/services/api.ts             strategy injection, terminal-code table
src/services/files.service.ts   XHR auth headers
src/services/auth.service.ts    login/register/forgot/reset, token capture;
                                unregister push before ending the session (P4.1)
src/services/geo-tracker.service.ts  bearer + credentials:'omit' on native (P4.6)
src/lib/push.ts                 native guard
src/lib/notification-display.ts dashboardRoute() split out for deep links (P4.2)
src/App.tsx                     public auth routes, remove the localhost redirect;
                                back button, top inset, keyboard-aware padding,
                                offline banner, toaster offsets (Phase 3);
                                useDeepLinks (P4.2)
src/main.tsx                    status bar / keyboard / link interceptor init (P3.3–P3.5);
                                native push + access-token seams (P4.1, P4.6)
src/onboarding/store/onboarding.store.tsx  token capture on auth-me
src/onboarding/OnboardingLayout.tsx        top + bottom safe-area insets (P3.3)
src/components/layout/PlatformStatus.tsx   real network source (P3.4)
src/components/layout/MobileTabBar.tsx     hides while the keyboard is up (P3.2)
src/components/agency-settings/UnsavedChangesBar.tsx   same (P3.2)
src/hooks/useGeoTrackerSocket.ts           reconnect on network restore (P3.4);
                                           10-min re-handshake + a close race (P4.6)
src/hooks/usePushRegistration.ts           permission/support/cache via the
                                           platform layer; rotation (P4.1)
src/components/features/MediaPicker.tsx    Upload opens the source sheet (P4.3)
src/pages/MediaLibrary.tsx                 same (P4.3)
src/components/common/AddressSearchInput.tsx        native geolocation (P4.4)
src/components/agency-settings/notifications/ChannelSetupDialog.tsx  clipboard (P4.5)
src/components/billing/BillingTab.tsx      reads the purchase gate; no
                                           PaymentDialog on native (P5.2)
src/components/billing/PlansCatalog.tsx    optional onBuy — no button, no
                                           disabled button (P5.2)
src/components/billing/CreditWalletCard.tsx  optional onBuyPack; packs and
                                           prices stay (P5.2)
src/components/billing/SavedPaymentMethodsCard.tsx  no Add button and no
                                           dialog on native; the list, default
                                           and remove all stay (P5.2)
src/i18n/locales/*/nav.json                3 keys, all five locales (Phase 3)
src/i18n/locales/{en,fr}/{settings,media}.json      19 keys (Phase 4)
src/i18n/locales/{en,fr}/billing.json               4 keys (Phase 5)
env/.env.{development,production,mobile,example}    VITE_WEB_DASHBOARD_URL (P5.1)
android/app/src/main/AndroidManifest.xml   intent filters, 4 runtime permissions,
                                           3 non-required features (P4.1–P4.4)
index.html                      self-hosted fonts; theme-color, light and dark
```

The two commented-out channel cards
(`components/agency-settings/notifications/{Telegram,Whatsapp}LinkCard.tsx`)
carry a note naming `openExternal` as what their `window.open` has to become —
they are not otherwise touched.

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

Phase 1 is the only phase that touches shared code and ships behaviour to web; everything else is native-only or behind `isNative`. If a phase needs reverting, Phase 1 is the only one where a revert affects web users — which is why its exit criteria demand the full web sweep in both modes before merge.

**Phase 5 was written down as a second exception and turned out not to be one.**
It does edit shared billing components, but every edit is behind
`purchasesEnabled`, and the two components it touches take an optional callback
the web build always supplies. A revert changes nothing a browser can see.

**Phase 3 is a partial exception and should be read as one.** All of its
behaviour is either behind `isNative` or behind an `env(safe-area-inset-*)` that
resolves to 0 in a browser — except P3.4, which deliberately ships the offline
banner and an honest status dot to web as well, because "always green in
airplane mode" was a bug there too. A Phase 3 revert would take those with it and
nothing else.

**Phase 4 is a partial exception for the same reason, in two places.** Almost all
of it is behind `isNative` — the platform modules fall through to today's browser
code, and `UploadSourceSheet` never opens on the web. The exceptions are both
fixes rather than features, and a revert would take them with it:

- **P4.5** — the WhatsApp setup dialog reports a failed copy instead of leaving
  an unhandled promise rejection and a "Copied!" that never arrives.
- **P4.6** — the live map re-handshakes every ten minutes on *both* transports,
  because a browser attaches `access_token` to a WebSocket handshake exactly once
  and the subscription otherwise dies mid-delivery with a misleading reason.
  This one also fixed a socket-close race in `reconnect()` that predates the
  phase.

There is a **third** web-visible change, smaller but worth naming rather than
discovering: **logout now unregisters the push device on web too.** Previously
only the settings toggle did, so a browser where someone had enabled push kept
receiving that account's notifications after they signed out — on a shared
machine, a real leak. The cost is that signing back in requires re-enabling push.
That is the plan's instruction (P4.1) and it is the right trade, but it is not a
no-op: a web user who never enabled push sees nothing, and one who did will
notice.

The rest of what Phase 4 touched on shared code resolves to the previous
behaviour on the web: `usePushRegistration` reads the same `Notification` API and
the same `agency:pushToken` key through one more indirection, and the Upload
buttons click the same hidden input they always did.
