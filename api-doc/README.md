# agency-dash — backend API contract

**Verified against source on 2026-09-08** — every count below re-measured, not carried forward.

| Measured 2026-09-08 | Was |
|---|---|
| Files in this directory | **72** (70 `.md` + `error-codes.ts` + `ticket_types.txt`) — was 71 |
| `/api/agency` routes | **132** — unchanged |
| Error registry ([`error-codes.ts`](./error-codes.ts), which is current) | **640** codes — was quoted as 603 in one place and 625 in another |
| jovi-mall whole-service census | **764** routes — was 665 |

⚠ **Re-measure; never copy a number forward.** The registry figure alone has read
541 → 621 → 623 → 625 → **640** across editions of this program, and stale values were quoted
onward into other repositories before anyone noticed.

Rebuilt 2026-08-24 against the two backends as they are actually implemented; re-verified
2026-09-08.

This is the contract the agency dashboard is built from. It is the only dashboard in this
platform that is a **client of two services**, and almost everything confusing about it follows
from that.

> ### Start here
>
> | If you are… | Read |
> |---|---|
> | picking this up after a while away | 🔴 [**MIGRATION-2026-08.md**](./MIGRATION-2026-08.md) — one socket frame can make the UI lie. ✅ Its "7 broken service calls" are **fixed** (re-checked in `src/` on 2026-09-08) |
> | looking for an endpoint | [**ROUTE-MAP.md**](./ROUTE-MAP.md) — all 132 agency routes, the 56 shared ones, all 22 geo-tracker routes, each mapped to exactly one document |
> | building the live map | [agency/live-tracking.md](./agency/live-tracking.md) → [geo-tracker/tracking-websocket.md](./geo-tracker/tracking-websocket.md) → [tracking/privacy-gates.md](./tracking/privacy-gates.md) |
> | handling an error | [errors/README.md](./errors/README.md) · [error-codes.ts](./error-codes.ts) (**640** codes, re-counted 2026-09-08) · [geo-tracker/errors/README.md](./geo-tracker/errors/README.md) |

---

## 1 · Two services, and how to tell which you are talking to

| | **jovi-mall** ("Project A") | **geo-tracker** ("Project B") |
|---|---|---|
| Owns | users, orders, shipments, money, inventory, **and the tracking authorization policy** | live positions, the WebSocket fan-out, routing |
| Base URL | `VITE_API_BASE_URL`, default `http://localhost:8022/api` | `VITE_GEO_TRACKER_URL`, default = the WS origin (`http://localhost:8090`) |
| Socket | — | `VITE_GEO_TRACKER_WS_URL`, default `ws://localhost:8090/ws/track` |
| Path prefix | **`/api/…`** | **none** — routes are mounted at the root (`/ws/track`, `/tracking/sessions`) |
| Credential | the session — httpOnly cookie on the web, bearer token in the Capacitor shell | **the same jovi-mall access token** |
| Client in `src/` | `services/api.ts` (+ `services/http.ts`) | `services/geo-tracker.service.ts` |
| Error envelope | `{ success, requestId, error: { code, message, statusCode, category, details? } }` | **the same** since Phase 16 |
| Rate limit | 900 / min per agency identity | 600 / min per IP; **20 frames/s per socket** |

**One token, two services.** geo-tracker verifies the *same* HS256 access token with the *same*
signing secret. You never mint anything for it, and you never call
`GET /api/tracking/visible-agents` yourself for tracking purposes — geo-tracker calls it **as
you**, forwarding your token.

**Three ways the token reaches the socket**, tried in this order
(`geo-tracker/internal/modules/tracking/delivery/ws/handler.go:450-472`):

1. the **httpOnly `access_token` cookie**, attached automatically when geo-tracker is same-site
   with jovi-mall — this is the browser path, and it needs no token handling in JS at all;
2. `Sec-WebSocket-Protocol: bearer, <token>` — for a client that *holds* the raw token
   (browsers cannot set `Authorization` on a WebSocket);
3. `Authorization: Bearer <token>` — native clients.

The Capacitor shell uses (2), reading the token from `window.wiMallGetAccessToken`.

⚠ **geo-tracker allows a closed request-header list** — `Authorization`, `Content-Type`,
`X-Request-Id`. A custom header on a geo-tracker call fails CORS. `ALLOWED_ORIGINS` drives both
its HTTP CORS **and** its WebSocket `CheckOrigin`; there is no separate WS setting, so the
Capacitor origins must be in that one variable.

### The division that explains the whole map

| | Comes from | Refresh cadence |
|---|---|---|
| **which** agents, **which** shipments, **where** the pins are | jovi-mall — `GET /api/agency/tracking/board` | minutes; a slow poll, plus on a revoke |
| **movement** | geo-tracker — `location_broadcast` on `/ws/track` | seconds |
| the **road line** between two pins | geo-tracker — `POST /routing/route` | on selection |
| the **GPS trail** of a delivery | geo-tracker — `GET /tracking/sessions/:agentId/checkpoints` | on selection |

**The board never calls geo-tracker.** geo-tracker being down costs you the moving markers and
nothing else: agents, shipments and both pins still render. Keep it that way — deliveries work
today when geo-tracker is down and they should keep working.

---

## 2 · What is deliberately not here

Three files in `geo-tracker/api-doc/` are **not mirrored into this repository**, on the owner's
decision:

| Not here | Why |
|---|---|
| `webhooks.md` (`POST /webhooks/node`) | inbound, **HMAC-SHA256** from jovi-mall's dispatch worker |
| `agent-action-audit.md` (`POST /webhooks/agent-actions`) | same — inbound, HMAC, jovi-mall only |
| `service-data-door.md` (`GET /internal/*`) | a **wi-admin service token** with a configured scope set; inert unless `GEO_TRACKER_ADMIN_TOKEN` is set |

All three are backend-to-backend. Documenting a surface no client of this app can reach invites
somebody to try, and the credentials involved — a shared HMAC secret, a wi-admin service token —
must never be anywhere near a browser bundle. They are listed with their auth in
[ROUTE-MAP.md § 3](./ROUTE-MAP.md) so a reader can tell *"not documented"* from *"not ours"*, and
the full text is in `backend/geo-tracker/api-doc/` if you ever need it.

The same distinction is drawn for jovi-mall in [ROUTE-MAP.md § 2](./ROUTE-MAP.md) under
*Deliberately out of scope* — `/api/internal/*`, the other roles' trees, and the gateway webhooks.

⚠ `POST /api/tracking/agent-state` looks callable and is not: it is the service-token receiver
for geo-tracker's notifications **into** jovi-mall.

---

## 3 · Index

### Start / cross-cutting

| | |
|---|---|
| 🔴 [MIGRATION-2026-08.md](./MIGRATION-2026-08.md) | what changed, worst first |
| [ROUTE-MAP.md](./ROUTE-MAP.md) | every route → exactly one document |
| [errors/README.md](./errors/README.md) · [error-codes.ts](./error-codes.ts) | the envelope, the nine categories, and the code registry — **640** codes as of 2026-09-08 (the file itself was already current; only this line was behind) |
| [rate-limits.md](./rate-limits.md) | ceilings, headers, and why a `429` must not sign anyone out |
| [health.md](./health.md) · [system-uptime-status.md](./system-uptime-status.md) | probes and the status surface |
| [billing-plans-across-roles.md](./billing-plans-across-roles.md) | the one owner-scoped plan engine |
| [reviews.md](./reviews.md) 🆕 | the cross-role review model — an agency reviews a **delivery** |

### Auth & account

| | |
|---|---|
| [auth/README.md](./auth/README.md) | sessions, roles, the whole auth surface (**+592 lines** on the old copy) |
| [auth/onboarding.md](./auth/onboarding.md) | first-run |
| [auth/FRONTEND-CHANGELOG-mobile-auth.md](./auth/FRONTEND-CHANGELOG-mobile-auth.md) · [mobile-auth-backend-spec.md](./mobile-auth-backend-spec.md) | `/api/auth/mobile/*` — the Capacitor namespace |
| [auth/magic-login.md](./auth/magic-login.md) 🆕 | bot sign-in, and `/reset-password` from a chat — **works for an agency account** |
| [me/password.md](./me/password.md) · [me/contact-change.md](./me/contact-change.md) 🆕 · [me/account-closure.md](./me/account-closure.md) 🆕 | the shared `/api/me` surface |
| [connections/README.md](./connections/README.md) 🔴🆕 | messaging connections — **replaces the 7 dead calls** |

### Files, media, geo

| | |
|---|---|
| [uploads/README.md](./uploads/README.md) | the shared upload + file library |
| [files/private-files.md](./files/private-files.md) 🔴🆕 | `FileDetail.url` is `string \| null` — **delivery-proof photos have no URL** |
| [agency/file-management.md](./agency/file-management.md) · [agency/storage.md](./agency/storage.md) | the agency's own quota and library |
| [geo/README.md](./geo/README.md) | address search & reverse geocode (**jovi-mall's**, not geo-tracker's) |

### Tracking — jovi-mall's half (policy)

| | |
|---|---|
| [tracking/live-tracking.md](./tracking/live-tracking.md) | *who may watch whom*, and how a revocation is pushed |
| [tracking/privacy-gates.md](./tracking/privacy-gates.md) 🆕 | **the two gates, as one section.** Read before building the map |
| [tracking/agent-tracking-policy.md](./tracking/agent-tracking-policy.md) | the admin allow-flag and the internal doors (context; not agency-callable) |
| [tracking/shipment-destination.md](./tracking/shipment-destination.md) 🆕 | how geo-tracker gets an ETA target without your client sending one |

### Tracking — geo-tracker's half (mechanics)

| | |
|---|---|
| [geo-tracker/README.md](./geo-tracker/README.md) | the service, its two authorization paths |
| 🔴 [geo-tracker/tracking-websocket.md](./geo-tracker/tracking-websocket.md) | **the priority file.** Frames, ETA resolution, the three revoke reasons, the WS error codes, reconnect |
| [geo-tracker/tracking-sessions.md](./geo-tracker/tracking-sessions.md) | a session is **one shipment's** tracking lifecycle |
| [geo-tracker/locations.md](./geo-tracker/locations.md) | last-known position over HTTP |
| [geo-tracker/gps-persistence.md](./geo-tracker/gps-persistence.md) 🆕 | live position vs. the downsampled trail; retention |
| [geo-tracker/routing.md](./geo-tracker/routing.md) | route · ETA · matrix · geocode — and the **`501`** on the default provider |
| [geo-tracker/tracking-notifications.md](./geo-tracker/tracking-notifications.md) 🆕 | the reverse channel (context — geo-tracker → jovi-mall) |
| [geo-tracker/health.md](./geo-tracker/health.md) 🆕 · [geo-tracker/rate-limits.md](./geo-tracker/rate-limits.md) 🆕 | probes; the HTTP and **frame** ceilings |
| [geo-tracker/errors/README.md](./geo-tracker/errors/README.md) | its envelope and status table (one correction noted) |
| [geo-tracker/FRONTEND-CHANGELOG-phase-2-3.md](./geo-tracker/FRONTEND-CHANGELOG-phase-2-3.md) 🆕 · [phase-4-5](./geo-tracker/FRONTEND-CHANGELOG-phase-4-5.md) 🆕 | what the readiness phases changed for a client |

### The agency's own surface — 132 routes

| Area | | Routes |
|---|---|---:|
| Agents & contracts | [agency/agent-roster.md](./agency/agent-roster.md) — **canonical for the agent↔agency contract** | 30 |
| Support | [agency/tickets.md](./agency/tickets.md) · [ticket_types.txt](./ticket_types.txt) | 14 |
| Billing & money in | [agency/billing.md](./agency/billing.md) (plans, credits, settings, transactions) | 11 |
| Warehouse | [agency/inventory.md](./agency/inventory.md) (**+151 lines: the physical shelf**) | 11 |
| COD cash | [agency/cod-cash-management.md](./agency/cod-cash-management.md) | 9 |
| Vendors | [agency/vendor-connections.md](./agency/vendor-connections.md) · [agency/vendors.md](./agency/vendors.md) · [agency/products.md](./agency/products.md) | 8 + 2 |
| Notifications | [agency/notifications.md](./agency/notifications.md) · [notifications/whatsapp-templates.md](./notifications/whatsapp-templates.md) · [whatsapp/README.md](./whatsapp/README.md) · [telegram/README.md](./telegram/README.md) | 7 |
| Onboarding & creation | [agency/onboarding.md](./agency/onboarding.md) | 6 |
| Assignment | [agency/assignment.md](./agency/assignment.md) | 6 |
| Stock requests | [agency/stock-requests.md](./agency/stock-requests.md) | 6 |
| Profile | [agency/profile.md](./agency/profile.md) · [agency/profile-schema.md](./agency/profile-schema.md) | 4 |
| Shipments | [agency/shipments.md](./agency/shipments.md) | 4 |
| Storage statements | [agency/storage-invoices.md](./agency/storage-invoices.md) 🆕 | 4 |
| Earnings & payout | [agency/earnings.md](./agency/earnings.md) · [agency/payout-methods.md](./agency/payout-methods.md) · [agency/payment-methods.md](./agency/payment-methods.md) | 3 |
| Reviews | [reviews.md](./reviews.md) | 3 |
| Depots | [agency/magazin.md](./agency/magazin.md) | 2 |
| Live-tracking board | [agency/live-tracking.md](./agency/live-tracking.md) | 1 |
| Delivery proof | [files/private-files.md](./files/private-files.md) | 1 |

Changelogs: [agency/FRONTEND-CHANGELOG-phase-2-3.md](./agency/FRONTEND-CHANGELOG-phase-2-3.md) 🆕 ·
[phase-4-5](./agency/FRONTEND-CHANGELOG-phase-4-5.md) 🆕 ·
[FRONTEND-CHANGELOG-agency-storage.md](./FRONTEND-CHANGELOG-agency-storage.md) ·
cross-role [phase-2-3](./FRONTEND-CHANGELOG-phase-2-3.md) 🆕 · [phase-4-5](./FRONTEND-CHANGELOG-phase-4-5.md) 🆕

---

## 4 · Ten things this dashboard gets wrong if nobody says them

1. **Visibility derives from shipments, not the roster.** A browsable agent is not a watchable
   one, and an idle roster member never appears on the board. There is no agency route that could
   make one appear.
2. **A shipment on an unaccepted offer is absent from the board** even though its status is
   trackable — `trackableShipmentsForAgency` also requires `agent_id != null`. It appears the
   moment the agent accepts.
3. **`failed` is *active* but not *trackable*.** Three status subsets disagree; build the map from
   the board endpoint and never from a locally-derived active set.
   [Table](./agency/shipments.md#status-subsets).
4. **Grants are not pushed.** A newly-authorised viewer is refused until `PERMISSION_CACHE_TTL`
   (5 min) expires, and **a reconnect does not refresh it** — the cache is user-keyed in Redis and
   outlives the socket. Revocation *is* pushed. Both are deliberate: the leak direction gets the
   push, the inconvenience direction does not.
5. **`permission_revoked` has three reasons and only one is about a delivery.**
   [§ 2 of the migration](./MIGRATION-2026-08.md#2--permission_revoked-now-carries-one-of-three-reasons).
6. **An opted-in agent with no delivery is locatable but not tracked.** An empty `checkpoints`
   array is a normal answer. [The two gates](./tracking/privacy-gates.md).
7. **A frozen marker with no frame has three possible causes** and the socket distinguishes none
   of them. `GET /tracking/sessions/:agentId` is the only way to tell them apart.
8. **`FileDetail` is an object and proof photos carry `url: null`.** Use
   `GET /api/agency/shipments/:id/delivery-proof/file`.
9. **Business identity is the Magazin, not the profile.** Business name and logo live on
   `Magazin`; the profile holds `display_name` + `avatar`.
10. **The agency plan cap is soft**, driven by `UNTERMINATED_SHIPMENT_STATUSES`; the agent cap is
    plan-driven. And **`cod.threshold` defaults to `0`**, which silently removes an agent from
    every COD candidate list —
    [detail](./agency/cod-cash-management.md#risk-controls-affecting-your-operation).

---

## 5 · How this was verified, and how to re-verify it

Every page carries either a **verified-against-source** banner naming the files and line ranges
it was checked against, or a **corrections** section where the backend's own text was wrong. The
governing rule was:

> The current backend implementation is the source of truth. Documentation — including the
> backend's own — is a claim about it, and a claim is not evidence.

That is not a slogan: **six** claims in the text this repository copied turned out to be false,
and one of them (COD's `agent_delivered`) was inverted. They are listed in
[MIGRATION § 12](./MIGRATION-2026-08.md#corrections-to-the-backends-own-documentation) and filed
in `backend/FRONTEND-SYNC/03-FINDINGS-REGISTER.md`.

```bash
# 1 · the 132 agency routes, from the live router
cd backend/jovi-mall && node -r ts-node/register/transpile-only -r dotenv/config \
    ../FRONTEND-SYNC/tools/dump-routes.js "$(pwd)/src/app.ts" | grep -c " /api/agency"

# 2 · the error-code count must equal error-codes.ts's header
grep -cE "^\s+[A-Z0-9_]+:\s*'" backend/jovi-mall/src/core/error-codes.ts        # 640 on 2026-09-08
grep -cE "^\s+[A-Z0-9_]+:\s*'" frontend/agency-dash/api-doc/error-codes.ts     # must match

# 3 · drift of the mirrored files against the backend
node backend/FRONTEND-SYNC/tools/doc-drift.js | sed -n '/agency-dash/,/^$/p'

# 4 · nothing outside api-doc/ was touched
git -C frontend/agency-dash status --short | grep -v "api-doc/"                # empty
```

⚠ **Do not trust `wc -l` on the route dump.** It prints ten boot-log lines, a blank line and its
own `TOTAL` footer — twelve extra lines. On 2026-09-08 `wc -l` reads **776** where the honest
count is **764**. `grep -cE '^(GET|POST|PUT|PATCH|DELETE) '` is the measure to use; the per-role
counts are unaffected. (This note previously read "677 … really 665"; both halves were a census
old — the whole-service figure has since grown to 764 while `/api/agency` stayed at 132.)

⚠ **Deliberate drift is expected now, and it is not staleness.** This repository's copies of the
backend's pages carry verification banners and corrections the backend's own copies do not, so
`doc-drift.js` reports most files as drifted. Read the banner at the top of a page before
concluding it is behind: a page that says *"verified against source 2026-08-24"* is ahead of the
backend's text, not behind it. `error-codes.ts` is reported as an *orphan* — that is also
expected, it is a copied source file rather than an api-doc page.

### The propagation gap this effort exists to close

Fourteen `FRONTEND-CHANGELOG-*` documents were written by the backend **specifically to tell
frontends what broke**, and not one of them had ever reached any frontend repository. Seven now
live here. The durable fix is a release step, not a periodic audit: **when a backend phase writes
a frontend changelog, copy it into the affected frontends in the same change.** Until that
happens, re-run the four commands above and read `backend/FRONTEND-SYNC/` before a big release.
