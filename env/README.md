# Environment configuration (`env/`)

Vite is configured (`vite.config.ts` → `envDir`) to load all `.env*` files from
**this folder** instead of the project root.

## Files

| File | Purpose | Git |
|------|---------|-----|
| `.env.development` | Dev defaults for `npm run dev`. Non-secret localhost values. | committed |
| `.env.production` | Production values for `npm run build` and `npm run build:mobile`. Non-secret `*.wi-mall.com` hosts. | committed |
| `.env.mobile` | **On-device dev** for `npm run build:mobile:lan`. Points at the dev machine's LAN address instead of loopback. | committed |
| `.env.example` | Reference template of every variable. | committed |
| `.env.development.local` | **Your** machine-specific / secret overrides (e.g. a real token). Overrides `.env.development`. | **git-ignored** |
| `.env.mobile.local` | **Your** LAN address, when the committed one has drifted. Overrides `.env.mobile`. | **git-ignored** |

Precedence (highest wins): `.env.<mode>.local` → `.env.<mode>` → `.env` → code defaults,
where `<mode>` is `development` for `npm run dev`, `production` for `npm run build` and
`npm run build:mobile`, and `mobile` for `npm run build:mobile:lan`.

⚠ Modes do not stack. `--mode mobile` loads `.env.mobile` and **not**
`.env.production`, which is why `.env.mobile` repeats every value it needs rather
than only the ones that differ.

## Production hosts

| Host | App |
|------|-----|
| `wi-mall.com` | Main website — owns the login screen this dashboard redirects to |
| `agency.wi-mall.com` | **This app** (Wi-Agency) |
| `agent.wi-mall.com` | Agent web |
| `vendor.wi-mall.com` | Vendor dashboard |
| `api.wi-mall.com` | Backend API |

## Variables

| Variable | Required? | Default | Notes |
|----------|-----------|---------|-------|
| `VITE_API_BASE_URL` | ✅ | `http://localhost:8022/api` | wi-mall backend. Must end in `/api`. Production: `https://api.wi-mall.com/api`. |
| `VITE_APP_NAME` | — | `Wi-Agency` | Display name. |
| `VITE_LOGIN_URL` | — | `http://localhost:3000/login` | Where `/login` redirects. Login lives on the main site, so this is the landing app in dev and `https://wi-mall.com/login` in production. |
| `VITE_GEO_TRACKER_WS_URL` | — | `ws://localhost:8090/ws/track` | geo-tracker live-tracking WebSocket. |
| `VITE_GEO_TRACKER_URL` | — | *(the WS URL's origin)* | geo-tracker **HTTP** origin, for the travelled-path trail (`/tracking/sessions/:id/checkpoints`) and road routing (`/routing/route`). Same service as the socket, so the default derives it from `VITE_GEO_TRACKER_WS_URL`; set it only when the two are genuinely split. |
| `VITE_GEO_TRACKER_TOKEN` | — (cross-site only) | *(empty)* | Bearer-token **override** for the WS. Normally unneeded: the browser forwards the httpOnly `access_token` cookie on the same-site WS handshake (like `credentials:'include'`). Only set it when geo-tracker is on a different site/domain. |
| `VITE_MAP_TILE_URL` | — | *(empty → CARTO)* | Live Tracking basemap **override**. Leave empty to use the built-in default (CARTO, keyless, with light + dark styles). Set to a Leaflet URL template (`{s}/{z}/{x}/{y}`, optional `{r}` for retina) to switch providers without a code change. |
| `VITE_MAP_TILE_URL_DARK` | — | *(empty)* | Optional dark-theme tile template used with `VITE_MAP_TILE_URL`. When empty, the light tiles are CSS-dimmed in dark mode. |
| `VITE_MAP_TILE_ATTRIBUTION` | — | OSM | Attribution string shown on the map when `VITE_MAP_TILE_URL` is set. |
| `VITE_FORCE_MOBILE_AUTH` | — (dev only) | *(unset)* | `true` switches the app to the **mobile** auth transport — bearer tokens against `/api/auth/mobile/*`, `credentials:'omit'`, tokens in memory — so the native path can be exercised in a desktop browser with no device. Read only when the dev server is running; a production build inlines it to `false`. Set it in `.env.development.local`. |

## Values that must come from the backend / infra

Everything the app needs for **normal** manual testing is covered by the
localhost defaults above (auth uses httpOnly cookies from `VITE_API_BASE_URL`).
Two optional features need something the frontend can't self-supply:

1. **Live Tracking** — in dev this authenticates on your **session cookie**
   automatically (the WS handshake to same-site `localhost:8080` carries the
   httpOnly `access_token` cookie, just like `credentials:'include'`), **provided
   geo-tracker reads that cookie**. If geo-tracker only accepts the documented
   `bearer` subprotocol, or runs on a different domain in prod, supply a token via
   `VITE_GEO_TRACKER_TOKEN` (in `.env.development.local`) or a
   `window.wiMallGetAccessToken()` provider.
2. **Web push (FCM)** — requires a Firebase project + a
   `window.wiMallGetPushToken(): Promise<string|null>` provider (the FCM token).
   Not env-driven and not bundled here; push shows "not configured" until wired.

`.env.production` additionally carries three **`NEEDS INFRA INPUT`** blocks that
no one has supplied yet, and which the `wi-mall.com` cutover does not answer:
geo-tracker's production host (Live Tracking stays dark without it), the live
Stripe publishable key, and the production Firebase messaging config.

## Usage

```bash
# 1. (optional) create your personal overrides
cp env/.env.example env/.env.development.local
#    …then paste a real VITE_GEO_TRACKER_TOKEN if testing Live Tracking

# 2. run the dev server (reads env/.env.development[.local])
npm run dev
```

## Mobile (Capacitor)

```bash
# On-device development against the dev backend over the LAN.
# Reads env/.env.mobile[.local]; also relaxes cleartext + mixed content, which
# only the debug build type can use.
npm run sync:android:lan
npm run run:android          # the same thing, then installs and launches

# The native bundle that ships. Reads env/.env.production — the same bundle the
# web deploy gets, since only the shell differs.
npm run sync:android

npm run open:android         # Android Studio, for native-side work
```

**`localhost` inside a packaged app is the phone**, not your machine — which is
the whole reason `.env.mobile` exists. Two things have to be true for it to work:
your phone and dev machine are on the same network, and the backend listens on
`0.0.0.0` rather than `127.0.0.1`. A server bound to loopback is invisible over
the LAN no matter what address you put in the env file.

The committed LAN address is a DHCP lease and will drift. Override it in
`env/.env.mobile.local` rather than editing the committed file:

```bash
ipconfig            # Windows → IPv4 Address
```
