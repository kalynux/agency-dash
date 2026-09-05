# Tracking — the two privacy gates

**Authored 2026-08-24 (PLAN-3) from source.** This page exists because the single most common
misunderstanding in this domain is that "tracking" is one permission. It is **two independent
gates**, they are owned by **different services**, they are gated on **different facts**, and
they are not interchangeable. A dashboard that conflates them will show an empty map for an
agent who is streaming, or an ETA for an agent who is not.

Everything below was read off source, not from documentation:

| Fact | Source |
|---|---|
| Live-position gate | `geo-tracker/internal/modules/session/domain/entity.go:125-147` (`DeviceState.TrackingAllow`) |
| Trail gate | `…/domain/entity.go:257-271` (`Persists`) |
| The two are independent | `…/domain/service.go:194-206` (`Heartbeat`, returning `Persist` and `Checkpoints` separately) |
| Agent opt-out is refused mid-shipment | `…/domain/service.go:11-21,173-179` (`ErrTrackingAllowLocked`) |
| Admin revocation is never refused | `…/domain/service.go:164-184` (`SetTrackingAllow`) |
| jovi-mall's half of Tracking Allow | `jovi-mall/src/modules/agents/domain/services/agent-tracking-policy.service.ts` |
| Trackable statuses | `jovi-mall/src/modules/tracking-integration/services/visible-agents.service.ts:25-31` |

---

## 1 · The two gates

| | **Live position** | **Durable GPS trail** |
|---|---|---|
| What it is | the agent's current coordinate — Redis, every fix, broadcast over the socket | the persisted, downsampled path of one delivery — Postgres checkpoints |
| Gated on | **Tracking Allow** alone | **an open tracking session**, i.e. an active shipment |
| Needs a shipment? | ❌ **No** | ✅ Yes |
| Where you read it | `location_broadcast` frames on `/ws/track`; `GET /locations/{agentId}` | `GET /tracking/sessions/{agentId}/checkpoints` |
| Owned by | geo-tracker (device state) + jovi-mall (the admin flag) | geo-tracker |

### The consequence to build against

> **An opted-in agent with no delivery is *locatable but not tracked*.**

Their live position flows and their marker moves. `GET …/checkpoints` returns `[]`. That empty
array is a **normal answer**, not an error and not a bug — there is no session to have a trail.

This is deliberate rather than an oversight: reading an idle agent's position is exactly how
the platform finds the one closest to a pickup, so the live-position gate is intentionally
*not* conditioned on having a shipment.

The mirror image is also true and also normal: a fix that arrives while a session is impaired
(`disconnected` · `network_lost` · `location_disabled` · `tracking_disabled`) lifts the session
but writes **nothing** to the trail. So a trail is a *shape*, never every fix.

The trail is additionally **plausibility-gated**: the liveness half of a heartbeat is
unconditional, the checkpoint half obeys `fix.Plausible`. An implausible jump still proves the
device reported in — what is untrustworthy is the position, not the fact of the report — so it
recovers an impaired session and is not written down.

---

## 2 · Tracking Allow has two owners

This is the part that surprises people. "Tracking Allow" is one name for the **conjunction** of
two facts held in two services.

| Half | Owner | Written by | Field |
|---|---|---|---|
| Is tracking **allowed**? | jovi-mall | an **admin** (a privacy request, a dispute, a legal instruction) | `DeliveryAgent.tracking.allowed` |
| Has the **device** opted in? | geo-tracker | the **agent**, over the WS `device_state` frame | `DeviceState.TrackingEnabled` |

geo-tracker's half is itself a conjunction of three (`entity.go:145`):

```
TrackingAllow  =  TrackingEnabled == true
              AND LocationEnabled           is not explicitly false
              AND LocationPermissionGranted is not explicitly false
```

Note the asymmetry, and it is deliberate: **the opt-in must be positively `true`** (privacy
first — no Tracking Allow by default), while the two device preconditions block only on an
**explicit `false`**. `null`/absent is "unknown", never "no" — coercing an unknown signal to
false would make every agent look ineligible the instant a signal went missing.

### How the admin flag reaches geo-tracker

`agent.tracking_allow_changed` → the tracking outbox → `POST /webhooks/node` →
`SetTrackingAllow`. Three properties of that path are load-bearing, and each of them is a thing
a dashboard could get wrong:

| Property | Why |
|---|---|
| An **admin** revocation is **never refused** | `ErrTrackingAllowLocked` protects a dispatched shipment from *the agent* changing their mind. This is the platform withdrawing its own permission — the lock does not apply. |
| It **ends no session** | Whether a delivery is over is jovi-mall's call, and this event does not make it. The session goes to `tracking_disabled`, which is an impairment. |
| It **revokes no watcher** | Watchers stay subscribed and simply receive nothing. **You will not get a `permission_revoked` frame.** A marker that silently stops moving is the only symptom. |

That last row is the practical one for this dashboard: if an operator reports "the marker
froze and nothing told me why", administrative Tracking Allow revocation is a candidate cause,
and it is indistinguishable on the socket from the agent's phone losing signal.

---

## 3 · The one refusal, and its direction

| Who | Action | Result |
|---|---|---|
| **Agent** | `device_state` with `trackingEnabled: false` **while a delivery is in flight** | ❌ **Refused.** Nothing is mutated, no session changes, and the agent's app receives `error` / `TRACKING_ALLOW_LOCKED`. |
| **Agent** | the same frame with **no** delivery in flight | ✅ Applied normally. |
| **Admin** | revoke `tracking.allowed` at any time | ✅ Always applied. Never refused. |
| **Physical reality** | GPS off, permission withdrawn, battery flat, tunnel | ✅ Always accepted. Drives the session to `location_disabled` / `network_lost` — an **impairment**, never an end. geo-tracker cannot refuse a dead battery. |

The reason the agent's opt-out is refused is that jovi-mall will not dispatch to an agent
without Tracking Allow (`agent-eligibility.service.ts`), so allowing a mid-delivery opt-out
would strand a shipment that was assigned on that promise.

---

## 4 · What this means for the agency dashboard

1. **Never derive "is this agent trackable" from your own roster.** Visibility derives from
   **shipments** — `trackableShipmentsForAgency` — not from the agent↔agency contract. A
   browsable agent is not a watchable one, and an idle roster member never appears on the
   board.
2. **An empty `checkpoints` array is not a failure.** Render the live marker; draw no history.
3. **Do not gate the live marker on the trail, or vice versa.** They answer different
   questions and fail independently.
4. **A frozen marker with no `permission_revoked` frame has three possible causes** and the
   socket distinguishes none of them: administrative Tracking Allow revocation, the agent's
   device losing GPS, or the agent's socket dropping. `GET /tracking/sessions/{agentId}` gives
   you the session's health state, which is the only way to tell them apart —
   see [geo-tracker/tracking-sessions.md](../geo-tracker/tracking-sessions.md).
5. **You cannot change either gate from this dashboard.** There is no agency route for
   Tracking Allow. It is admin-written in jovi-mall and agent-written on the device. What the
   agency *can* read is dispatch eligibility, which reports Tracking Allow as one of its
   failing reasons — `GET /api/agency/agents/:agentId/eligibility`.

---

## Related

- [live-tracking.md](./live-tracking.md) — *who may watch whom* (the visibility policy)
- [agent-tracking-policy.md](./agent-tracking-policy.md) — jovi-mall's admin/internal surface for the allow flag
- [../agency/live-tracking.md](../agency/live-tracking.md) — the board this dashboard actually calls
- [../geo-tracker/tracking-websocket.md](../geo-tracker/tracking-websocket.md) — the frames
- [../geo-tracker/gps-persistence.md](../geo-tracker/gps-persistence.md) — how the trail is stored, downsampled and cleaned
