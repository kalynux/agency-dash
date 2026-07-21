# Environment configuration (`env/`)

Vite is configured (`vite.config.ts` → `envDir`) to load all `.env*` files from
**this folder** instead of the project root.

## Files

| File | Purpose | Git |
|------|---------|-----|
| `.env.development` | Dev defaults for `npm run dev`. Non-secret localhost values. | committed |
| `.env.example` | Reference template of every variable. | committed |
| `.env.development.local` | **Your** machine-specific / secret overrides (e.g. a real token). Overrides `.env.development`. | **git-ignored** |

Precedence (highest wins): `.env.development.local` → `.env.development` → `.env` → code defaults.

## Variables

| Variable | Required? | Default | Notes |
|----------|-----------|---------|-------|
| `VITE_API_BASE_URL` | ✅ | `http://localhost:8022/api` | jovi-mall backend. Must end in `/api`. |
| `VITE_APP_NAME` | — | `Jovi Mall Agency` | Display name. |
| `VITE_GEO_TRACKER_WS_URL` | — | `ws://localhost:8090/ws/track` | geo-tracker live-tracking WebSocket. |
| `VITE_GEO_TRACKER_TOKEN` | — (cross-site only) | *(empty)* | Bearer-token **override** for the WS. Normally unneeded: the browser forwards the httpOnly `access_token` cookie on the same-site WS handshake (like `credentials:'include'`). Only set it when geo-tracker is on a different site/domain. |

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
   `window.joviGetAccessToken()` provider.
2. **Web push (FCM)** — requires a Firebase project + a
   `window.joviGetPushToken(): Promise<string|null>` provider (the FCM token).
   Not env-driven and not bundled here; push shows "not configured" until wired.

## Usage

```bash
# 1. (optional) create your personal overrides
cp env/.env.example env/.env.development.local
#    …then paste a real VITE_GEO_TRACKER_TOKEN if testing Live Tracking

# 2. run the dev server (reads env/.env.development[.local])
npm run dev
```
