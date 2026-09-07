# MIGRATION — what changed since this repository's docs were written

**Verified against source on 2026-09-08** — § 1's "seven dead service calls" re-checked directly in this repository's `src/` (`connections.service.ts:46,62,74`); they are fixed.

**Written 2026-08-24** · Source of truth: the two backends' current implementation, read
directly. Nothing on this page comes from a document.

This dashboard's `api-doc/` was a copy of the backend contract taken at some past date and never
refreshed. **20 of its 50 files had drifted, 33 relevant files had never arrived, and 7 live
service calls point at endpoints that no longer exist.** This page is the delta. The rest of
`api-doc/` is now the full contract — see [README.md](./README.md) and
[ROUTE-MAP.md](./ROUTE-MAP.md).

**Nothing under `agency-dash/src/` was changed by this work.** Every item below that needs a code
change says so and says what the change is; making it is the frontend team's call.

---

## Read in this order

| | | Why |
|---|---|---|
| 1 | [§ 1 · Seven dead service calls](#1--seven-dead-service-calls) | ✅ **Fixed** — read only for what replaced them. |
| 2 | [§ 2 · `permission_revoked` has three reasons](#2--permission_revoked-now-carries-one-of-three-reasons) | **The dashboard can lie to an operator.** |
| 3 | [§ 3 · Delivery-proof photos have no URL](#3--delivery-proof-photos-have-no-public-url) | Images render blank. |
| 4 | [§ 4 · A 90-day absolute session cap](#4--a-90-day-absolute-session-cap) | Sign-outs you cannot currently explain. |
| 5 | [§ 5 · geo-tracker changed its error shape](#5--geo-tracker-adopted-the-shared-error-envelope) | `error` is an object, not a string. |
| 6 | everything from § 6 down | New surface and behaviour, none of it breaking. |

---

## 1 · Seven dead service calls

✅ **FIXED — this section is now a historical record, not a defect.**

**Verified in this repository's `src/` on 2026-09-08.** `channels.service.ts` is gone; the
successor is `src/services/connections.service.ts`, and it calls the live routes —
`GET /me/connections` (line 46), `POST /me/connections` (62), `DELETE /me/connections/:channel`
(74). A grep for `webhooks/telegram`, `webhooks/whatsapp/link` and `request-wa-verification`
outside comments returns nothing; the only hits are the migration table this service file keeps
in its own header.

> ⚠ **The previous edition said "non-functional in this dashboard today", and by 2026-09-07 had
> been half-corrected** — it recorded that `channels.service.ts` was gone but declined to name a
> successor, correctly refusing to guess. That refusal was right; the missing step was going and
> looking, which is what closed it. Messaging connections work.

All seven were in the deleted `channels.service.ts` and every one returned `404`. Kept below
because the **replacement mapping** is still the contract.

> **The plan for this work said six. It is seven** — the same seventh call PLAN-1 found in
> `vendor-dash`. It was found by opening all **402** API path literals in `agency-dash/src/`
> by hand; the automated scanner reports a fraction of them, which is why the count was wrong.

| Line | Dead call | Replacement |
|---|---|---|
| 23 | `GET /webhooks/whatsapp/link/status` | `GET /api/me/connections` |
| 28 | `DELETE /webhooks/whatsapp/link` | `DELETE /api/me/connections/whatsapp` |
| 36 | `POST /auth/request-wa-verification` | `POST /api/me/connections` |
| 46 | `GET /webhooks/telegram/status` | `GET /api/me/connections` |
| 51 | `POST /webhooks/telegram/link-token` | `POST /api/me/connections` |
| 56 | `POST /webhooks/telegram/toggle` | `POST /api/me/connections` |
| 61 | `POST /webhooks/telegram/disconnect` | `DELETE /api/me/connections/telegram` |

**What survives at those prefixes:** exactly `POST /api/webhooks/whatsapp/` and
`POST /api/webhooks/telegram/webhook`, both inbound provider webhooks. There are no
authenticated link routes under `/api/webhooks/*` any more.

**The replacement inverts who mints the code.** One mechanism now covers every channel, and
**the bot issues the 6-character code, not the platform** — so the flow is "the user messages the
bot, the bot replies with a code, the user types it here", not "we give you a link to open". Full
contract: [connections/README.md](./connections/README.md). Nine error codes went away with the
old flow and four `CONNECTION_CODE_*` codes replaced them — see
[error-codes.ts](./error-codes.ts)'s header.

---

## 2 · `permission_revoked` now carries one of THREE reasons

🔴 **This is the change most likely to make the dashboard tell an operator something false.**

`permission_revoked` used to arrive with `reason: "shipment_completed"` — **always**, for every
one of three quite different situations, because the server discarded the outcome of its
re-authorization check. Any dashboard that reads that string and shows "delivered" is now, and
was then, capable of reporting a completed delivery because an access token aged out.

The value is now a **closed set of three** (`geo-tracker/internal/modules/tracking/domain/entity.go:149-164`):

| `reason` | What actually happened | What the board must do |
|---|---|---|
| `shipment_completed` | jovi-mall was asked, and answered: this agency is no longer entitled to that agent. | Drop the marker, refetch the board. **The only value from which you may report a delivery outcome.** |
| `authorization_expired` | jovi-mall **rejected the token** the socket was opened with (401/403). Nothing is known about the shipment. | Reconnect with a fresh token, re-subscribe. **Show nothing about the delivery** — keep the row, it is almost certainly still in flight. |
| `authorization_unavailable` | jovi-mall **could not be asked** (unreachable, 5xx, timeout). Nothing is known. | Retry with backoff. Report no outcome. |

**Treat any value you do not recognise as `authorization_expired`.** That rule is what makes a
fourth value safe to add later.

**`shipment_completed` keeps its exact value and meaning.** All three still drop the watcher — the
server fails closed on any viewer it cannot confirm. Only the explanation is new.

### The change to make

Wherever the socket's `permission_revoked` handler currently draws a conclusion, branch on
`payload.reason` first. Two more things belong in that handler, and both are already true today:

- **Do not reconnect on `permission_revoked`.** It is an answer, not a transport failure.
- **Do reconnect on a cadence shorter than the 15-minute access-token TTL.** The token is
  validated at the handshake and never re-validated on a timer — but a revocation check forwards
  *that same stale token* back to jovi-mall, so an old socket keeps working right up until
  something triggers a re-check and then dies as `authorization_expired`. There is no refresh
  path over the socket.

Full detail: [geo-tracker/tracking-websocket.md](./geo-tracker/tracking-websocket.md#permission_revoked)
and [tracking/live-tracking.md](./tracking/live-tracking.md).

> ⚠ The backend's own `agency/live-tracking.md` still told clients a `permission_revoked` frame
> means "the shipment finished". That sentence is corrected in this repository's copy and filed
> as a backend-documentation finding.

---

## 3 · Delivery-proof photos have no public URL

🔴 **A type change, deliberately, so your compiler points at every place that needs looking at.**

Three storage trees — `digital/`, **`shipments/`** and `ticket-attachments/` — left the static
file mount. Every `FileDetail` for a file in one of them now returns:

```json
{ "id": "665f…", "key": "shipments/proof-abc.jpg", "url": null, "access": "authorized",
  "mimeType": "image/jpeg", "size": 184320, "originalName": "proof.jpg" }
```

`FileDetail.url` is **`string | null`** and there is a new **`access: 'public' | 'authorized'`**
(`src/modules/catalog/read-models/product-detail.read-model.ts:27-46`). `url` being nullable
rather than an authorized path is the enforcement: a path here would be a string
indistinguishable from a public URL, so every client would keep rendering it and silently show
nothing.

**For this dashboard that means every delivery-proof photo.** Fetch the bytes from the dedicated
authorized route instead:

```
GET /api/agency/shipments/:id/delivery-proof/file
```

It is scoped by the **same** `findByIdAndAgency` predicate the shipment detail uses — the
authorization is re-used, not re-derived. There is deliberately **no agency upload or delete
twin**: the proof is the *agent's* record of what they did; the agency reads it and does not
author it.

**Rule of thumb:** `access === 'authorized'` ⇒ never put `url` in an `<img src>`. Fetch through
the owning entity's own route, keyed on `id`. Full detail:
[files/private-files.md](./files/private-files.md).

---

## 4 · A 90-day absolute session cap

🔴 One sign-in is now bounded at **90 days** regardless of activity
(`ABSOLUTE_SESSION_CAP_S = 7776000`, `src/core/auth/token.issuer.ts:27-49`, ADR-A03 D-1;
overridable via `AUTH_ABSOLUTE_SESSION_CAP`). Refreshing does not extend it — the cap is measured
from `auth_time`, not from last use.

**What you will see:** a refresh that has always succeeded starts failing for a long-lived
session, and the correct response is to sign the user out and show the login screen. A session
that has hit the cap cannot be recovered by retrying.

**Cross-service consequence:** geo-tracker's `RevokeForAgent` forwards the socket's handshake
token back to jovi-mall. A capped session therefore also surfaces on the socket as
`permission_revoked` / `authorization_expired` — see § 2. That is one cause with two symptoms;
handle both.

---

## 5 · geo-tracker adopted the shared error envelope

🔴 **geo-tracker's one breaking wire change.** It used to answer in **plain text** via Go's
`http.Error`, except the routing module which answered `{"error": "…"}` — a *string*. Every route
now returns the same envelope as jovi-mall:

```json
{ "success": false, "requestId": "3f9a…",
  "error": { "code": "TRACKING_ROLE_FORBIDDEN", "message": "This role may not track agents",
             "statusCode": 403, "category": "authorization" } }
```

**`error` is an object, not a string.** `details` is **omitted entirely** when absent — never
`null`, never `{}`. `X-Request-ID` is on every response and on a masked 5xx is the only handle
anybody has.

> ⚠ **Do not copy the error-body example out of the older `geo-tracker/routing.md`.** It showed
> the pre-change bare shape. The copy in this repository is current.

The **nine-value `category`** taxonomy — `authentication` · `authorization` · `validation` ·
`not_found` · `conflict` · `business_rule` · `rate_limit` · `external_service` · `internal` — is
shared by all three backends and is the right thing for a generic error handler to branch on. For
`internal` and `external_service` the message is replaced with a generic default and `details` is
dropped, **in every environment**.

`agency-dash/src/services/geo-tracker.service.ts` already reads the new envelope and keeps a
text fallback — no change needed there.

### One correction to the backend's own error page

`geo-tracker/api-doc/errors/README.md` lists **`409`** as a live status on `/ws/track` and
"session", and calls it new. **`http.StatusConflict` appears nowhere in the geo-tracker
codebase.** `TRACKING_ALLOW_LOCKED` is only ever a WebSocket error frame. Do not write a `409`
branch against geo-tracker.

---

## 6 · geo-tracker: session TTL is 72 h, and the trail is plausibility-gated

Neither is breaking; both change what "normal" looks like.

- **`TRACKING_SESSION_TTL` is 72 h** (was 48 h) — `internal/platform/config/config.go:290`,
  design record `geo-tracker/docs/ADR-B01-SESSION-TTL.md`. It is a *backstop* that a live
  session's heartbeat sweep keeps refreshing, not a delivery deadline.
- **The durable trail is plausibility-gated; the heartbeat is not.** An implausible GPS jump
  still proves the device reported in, so it recovers an impaired session and is **not** written
  to the trail. A trail is a shape, not every fix.
- **Grant latency is unchanged, on purpose.** Revocation is *pushed*; a newly-authorised viewer
  waits for `PERMISSION_CACHE_TTL` (5 min) to expire — **and a reconnect does not refresh it**,
  because the cache is user-keyed in Redis and outlives the socket. The leak direction gets the
  push; the inconvenience direction does not.

---

## 7 · Two privacy gates, not one

Not a change — a correction to a near-universal misunderstanding, and the most likely source of
"the map is broken" reports.

- **Live position** is gated on **Tracking Allow** alone, *not* on having a shipment. An
  opted-in agent with no delivery **is locatable** — that is how the platform finds the agent
  nearest a pickup.
- **The durable GPS trail** is gated on an open tracking session, i.e. an active shipment.

So an opted-in agent with no delivery is **locatable but not tracked**, and an empty
`checkpoints` array is a normal answer. Tracking Allow has two owners and the refusals run in
opposite directions: an **admin** revocation is never refused, **ends no session**, and
**revokes no watcher** (they stay subscribed and receive nothing — you get *no* frame); an
**agent** trying to switch it off mid-shipment **is** refused with `TRACKING_ALLOW_LOCKED`.

Full section, written from source: [tracking/privacy-gates.md](./tracking/privacy-gates.md).

---

## 8 · `/api/admin/*` no longer exists

jovi-mall's public admin surface is **gone**. `/api/internal/admin/*` is the only admin door, and
it is service-token authenticated — nothing in this dashboard can call it.

The one place this repository referenced it was `agency/agent-roster.md`'s § Transfers link to
`POST /api/admin/agents/transfer`. It now points at `/api/internal/admin/agents/transfer`, which
is **still admin-only**: an agency must not be able to pull an agent off a rival's roster. If
anything in `src/` constructs an `/api/admin` path, it is dead.

---

## 9 · New surface this repository never documented

| What | Routes | Document |
|---|---:|---|
| **Storage statements** — the monthly warehousing-rent record per (agency, vendor, month) | 4 | [agency/storage-invoices.md](./agency/storage-invoices.md) 🆕 |
| **Physical inventory** — receipts, returns, physical counts, depot-to-depot transfers, and the movement ledger | 6 of 11 | [agency/inventory.md](./agency/inventory.md) (+151 lines) |
| **Messaging connections** — the replacement for § 1 | 3 | [connections/README.md](./connections/README.md) 🆕 |
| **Reviews** — the cross-role review model; an agency reviews a *delivery* | 3 | [reviews.md](./reviews.md) 🆕 |
| **Change sign-in email / phone** | 8 | [me/contact-change.md](./me/contact-change.md) 🆕 |
| **Account closure** (customer-only; here for completeness) | 1 | [me/account-closure.md](./me/account-closure.md) 🆕 |
| **The drop-off pull** — how geo-tracker gets an ETA target without your client sending one | — | [tracking/shipment-destination.md](./tracking/shipment-destination.md) 🆕 |
| **geo-tracker: GPS persistence · tracking notifications · health · rate limits** | — | 4 new files under [geo-tracker/](./geo-tracker/) |

⚠ **Storage statements are a RECORD. The platform moves none of this money** — it neither
collects the rent from the vendor nor pays it to the agency, and `settle` is the agency *stating
it was paid out of band*. A "Settle" button that reads like "Pay" is the one way that screen can
mislead.

---

## 10 · Agent ↔ agency contracting replaced email invites entirely

The email-invite subsystem is **deleted**: `POST /api/agency/agents/invites` and its
`GET`/`DELETE` siblings are gone, as is `GET /api/agent/invites`.

Agents and agencies now find each other in a **directory** and contract through a **symmetric
request → accept / reject / withdraw** flow, mirroring vendor↔agency connections:

```
GET  /api/agency/agents/browse      the platform-wide directory; each row carries your standing
POST /api/agency/agents/requests    ask a specific agent to contract ON STATED TERMS
```

Three things a dashboard must get right, all verified from source:

1. **Terms are negotiated, and the authority is `termsProposedBy`** — not `origin`, which is now
   audit-only, and not `initiatedBy`. `awaitingDecisionFrom` is the *button rule*.
2. **A live contract changes by proposal, never by edit.** `PATCH …/terms` on an `active`
   contract answers **`409 CONTRACT_TERMS_LIVE_EDIT_NOT_ALLOWED`** and points at
   `…/terms-proposals`. On a `pending` contract the same call *is* the agency's counter.
3. **`withdrawn` is a *contract* status, not a shipment status.** The shipment enum geo-tracker
   shares is untouched by it.

Surviving vocabulary that looks like a live invite flow and is not: `origin: "invitation"` (now
means "the agency raised this"), `invitedAt`, and the `invited` event type. The three `invite_*`
event types appear only on historical rows.

Full contract, 30 routes: [agency/agent-roster.md](./agency/agent-roster.md).

---

## 11 · Rate limits now exist

There was **no rate limiting of any kind** in either backend before. Both now have one, and
neither is a budget — they are backstops set so no real user reaches them.

| | Scope | Ceiling | Env |
|---|---|---:|---|
| jovi-mall — identity layer, **agency** | per user | **900 / min** | `RATE_LIMIT_AGENCY_PER_MIN` |
| jovi-mall — global IP layer (before auth) | per IP | 1200 / min | `RATE_LIMIT_GLOBAL_PER_MIN` |
| jovi-mall — credential bucket (`login`, `register`, `forgot-password`, `reset-password`, `add-role`, …) | per IP | **20 / min** | `RATE_LIMIT_AUTH_PER_MIN` |
| jovi-mall — session bucket (`me`, `auth-me/:role`, `browser/refresh`, `mobile/refresh`) | per IP | 300 / min | — |
| geo-tracker — HTTP | per IP | **600 / min**, burst 60 | `RATE_LIMIT_PER_MINUTE` |
| geo-tracker — **WebSocket frames** | per **connection** | **20 / s**, burst 40 | `WS_FRAMES_PER_SECOND` |

Verified in `src/api/rate-limit/policy.ts:79-160` and
`geo-tracker/internal/platform/config/config.go:248-251`.

Three behaviours worth building for:

- **A `429` must never sign a user out.** `RATE_LIMIT_EXCEEDED` means the session is fine and the
  ceiling is not. `agency-dash/src/services/api.ts`'s `classifyAuthError` already gets this
  right, checking `isRateLimited` before the 401 default.
- **Read `Retry-After`** (seconds) in preference to the body field — the header is what lets a
  client slow down before it is refused. `RateLimit` / `RateLimit-Policy` headers are on every
  response.
- **Over the WS frame limit, the frame is dropped and the socket stays open.** Closing it would
  be worse than the flood: an agent may be mid-delivery. You get
  `error` / `WS_RATE_LIMITED`, and error frames are themselves throttled to ~1 per 5 s, so do
  not build anything that requires one per rejected frame.

The store **fails open**: a Redis outage must not put a single point of failure in front of every
route.

---

## 12 · Smaller things, and the traps

### Corrections to the backend's own documentation

Each of these was in the text this repository copied. All are corrected in place here, with the
source citation, and filed in `backend/FRONTEND-SYNC/03-FINDINGS-REGISTER.md`.

| Where | The claim | The source |
|---|---|---|
| `agency/shipments.md` § COD | "**`agent_delivered` is rejected**" for COD | 🔴 **False, and inverted.** It is accepted and is the *expected* state — reaching it is what triggers the delivery-code prompt. **Do not hide that action for COD shipments.** |
| `agency/live-tracking.md` § Drawing the map | a `permission_revoked` frame means "the shipment finished" | See § 2. |
| `tracking/live-tracking.md` § How the event push works | an event-bus *subscriber* writes the outbox row | That path was deleted. The row is now written **inside the transaction**. |
| `geo-tracker/errors/README.md` | `409` is a live status | `http.StatusConflict` is nowhere in the codebase. |
| `geo-tracker/README.md` role table | agency sees `assigned`, `picked_up`, `in_transit`, `agent_delivered` | Five statuses — **`handing_over` is missing** from that list. |
| `geo-tracker/tracking-websocket.md` § `error` | example omits `code` | `code` is populated at every send site; it is never absent in practice. |

### 🔴 Three status subsets that disagree

`failed` is **active** (it holds an agent's capacity slot) but **not trackable** and **not
unterminated**. A dashboard that builds its live map from a locally-derived "active shipments"
set will render a marker that never streams. Build it from `GET /api/agency/tracking/board`.
Full table: [agency/shipments.md § status subsets](./agency/shipments.md#status-subsets).

### 🔴 `cod.threshold` defaults to `0`, and two of three dispatch paths refuse silently

A newly-approved contract has **no COD headroom**, and `0` is not treated as "unset". On
`assign-agent` you get a `422`; on `assignment-candidates` and `auto-assign` the agent is simply
**absent, with no reason given**. Detail and source citations:
[agency/cod-cash-management.md § Risk controls](./agency/cod-cash-management.md#risk-controls-affecting-your-operation).

### Both shipment write paths are a compare-and-set

The agency and the assigned **agent** drive the same state machine through the same transition
table, and either may act at any moment. Both writes are a from-status compare-and-set: the loser
gets **`409 SHIPMENT_STATUS_CONFLICT`** with `details: { expectedStatus, to }`. **Reload and
decide again** rather than blind-retrying the same body — the correct next status may have
changed.

### Smaller notes

- **`delivered` is reachable from neither endpoint.** Prepaid: the customer confirms, or a 7-day
  sweep does. COD: the delivery code, or the same sweep.
- 🔴 **There are TWO unrelated types called `PaymentStatus`, and one of them mixes casing
  inside a single union.** Verified 2026-08-24 — the plan for this work said only "mixes
  casing", which understates it:

  | Type | Values |
  |---|---|
  | `orders/order.model.ts:38` — an **order's** payment status | `pending` · **`AWAITING_PAYMENT`** · `partially_paid` · `paid` · `disputed` · `failed` · `refunded` |
  | `payments/models/payment-transaction.model.ts:21` — a **transaction's** status | `INITIATED` · `PENDING` · `SUCCEEDED` · `FAILED` · `CANCELLED` · `REFUNDED` |

  So `PENDING` and `pending` are *different types' values*, not two spellings of one, and
  `AWAITING_PAYMENT` is the single upper-case member of an otherwise lower-case union. Do not
  write one shared enum for both, and do not lower-case-normalise across them — that would make
  an order's `pending` and a transaction's `PENDING` collide. Within each type, compare exactly;
  across them, keep the two apart.
- **Tickets paginate with `pagination`, not `meta`** — `res.json({ success, data, pagination })`,
  `tickets/controllers/ticket.controller.ts:85`.
- **Business identity is the Magazin, not the profile.** Agency business name and logo live on
  `Magazin`; the profile holds `display_name` + `avatar`.
- **Agency payout methods live on the profile**, not a dedicated route: `payout_details` is an
  array on the `DeliveryAgency` document (`delivery/delivery-agency.model.ts:356`), written via
  `PUT /api/agency/onboarding/payout` and `PATCH /api/agency/profile`. There is no agency
  payout-method CRUD surface — `/api/agency/earnings/payout` is a *withdrawal request*, not a
  destination. **Bank and card are modelled and switched off**:
  `ENABLED_PAYOUT_METHODS = ['mobile_money']` (`core/types/payout.types.ts:180`), enforced on
  write at `:521`. Offer mobile money only; the other two branches exist for a later release.
- **The agency plan cap is soft**; the agent cap is plan-driven.
- **geo-tracker's CORS allows a closed header list** — `Authorization`, `Content-Type`,
  `X-Request-Id`. Do not add a custom request header to a geo-tracker call.
- **`ALLOWED_ORIGINS` drives both geo-tracker's HTTP CORS and its WebSocket `CheckOrigin`** —
  one variable, no separate WS setting. Capacitor origins must be in it.
- **geo-tracker *does* expose geocoding** (`GET /routing/geocode`, `/reverse-geocode`), contrary
  to `backend/CLAUDE.md`. Whether it answers depends on `ROUTING_PROVIDER`: the default `osrm`
  cannot geocode and returns **`501`** with category `business_rule`. Address resolution for
  orders and profiles stays jovi-mall's (`/api/geo/*`).
- **The agent is paid by the platform, not by you.** COD cash flows Customer → Agent → Agency →
  Platform; agent earnings flow through the platform's own payout pipeline and never touch the
  agency.

### One claim that is NO LONGER a trap

**"The outbox is not transactional" is fixed.** `backend/CLAUDE.md` still lists it as an open
cross-service defect, and the plan for this work repeated it. Source disagrees at all nine call
sites: the outbox row is written **inside** the transaction that made the change, passing its
Mongo session, so there is no window in which a shipment moved and its tracking event was lost.
Keep the map's degradation path for a session that never opened — it is still possible, via
callers that legitimately have no transaction — but stop treating it as the expected outcome of a
crash. Evidence: [tracking/live-tracking.md § Where this document is wrong](./tracking/live-tracking.md#where-this-document-is-wrong).

---

## What was NOT changed, and will not be

- **No file under `agency-dash/src/` was touched.** Including `channels.service.ts`, whose seven
  calls are broken. This effort documents; the frontend team changes.
- **No backend file was edited**, except `03-FINDINGS-REGISTER.md` and this effort's own progress
  record, both of which exist for that purpose.
- **The forwarded-token refresh asymmetry is deliberate and must not be "fixed".** jovi-mall
  refreshes from a cookie; geo-tracker forwards only a bearer token, so an expired one drops the
  subscription. A client reconnects with a fresh token instead. It is on the backend's
  do-not-fix list.
- **`webhooks.md`, `service-data-door.md` and `agent-action-audit.md` are not mirrored here.**
  All three are backend-to-backend surfaces this dashboard cannot reach, authenticated by a
  shared HMAC secret or a wi-admin service token. Reason recorded in
  [README.md](./README.md) and [ROUTE-MAP.md § 3](./ROUTE-MAP.md).
