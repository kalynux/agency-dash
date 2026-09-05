# Routing, Geocoding & ETA

On-demand access to the active routing provider. Every endpoint is
**provider-agnostic**: the response shape is identical no matter which backend
`ROUTING_PROVIDER` selects (`osrm` | `locationiq` | `geoapify` | `mapbox` |
`google`). Switching providers is a config change; clients never notice.

## Base path

```
/routing
```

## Authentication

`Authorization: Bearer <jovi-mall access token>` — any authenticated actor.

## Provider capability matrix

| Provider | Route | Matrix | Geocode | Reverse geocode |
|---|:--:|:--:|:--:|:--:|
| `osrm` | ✅ | ✅ | ❌ | ❌ |
| `locationiq` | ✅ | ✅ | ✅ | ✅ |
| `geoapify` | ✅ | ✅ | ✅ | ✅ |
| `mapbox` | ✅ | ✅ | ✅ | ✅ |
| `google` | ✅ | ✅ | ✅ | ✅ |

**Matrix verified against source 2026-08-24 (PLAN-3):** only `osrm` returns
`domain.ErrUnsupported`, and only from `Geocode` and `ReverseGeocode`
(`internal/modules/routing/provider/osrm/provider.go:119-125`). All five implement `GetRoute`
and `GetDistanceMatrix`. **`osrm` is the default** (`config.go:307`), so on a stock deployment
the two geocoding routes answer `501` and the three routing ones work.

OSRM is a pure routing engine. Calling a geocoding endpoint while it is active
returns **`501 Not Implemented`** — a clear, expected answer, not a server fault, and
deliberately `business_rule` rather than `external_service`: nothing failed, and no amount of
retrying will change it (`internal/modules/routing/delivery/http/handler.go:163-176`).

> 🔴 **Corrected 2026-08-24.** The backend's own copy of this page showed the body as
> `{"error": "active provider does not support geocode"}` — **the pre-Phase-16 shape, where
> `error` was a bare string.** A client written against that example will not find the message,
> and this was the one example most likely to be copied into a client. The real body is the
> shared envelope:
>
> ```json
> { "success": false, "requestId": "3f9a…",
>   "error": { "code": "ROUTING_CAPABILITY_UNSUPPORTED",
>              "message": "The active routing provider does not support geocode",
>              "statusCode": 501, "category": "business_rule" } }
> ```
>
> The `502` case is `ROUTING_PROVIDER_FAILED` with category `external_service` — which means
> its message is replaced with a generic default and `details` is dropped, **in every
> environment**. Report the `requestId`, not the message.
>
> ⚠ **For this dashboard**, the practical consequence is narrow: the only routing call
> `agency-dash/src/` makes is `POST /routing/route`, which every provider supports. Do not add
> a geocoding call here — address search is jovi-mall's `/api/geo/search`
> ([../geo/README.md](../geo/README.md)), which is the platform's real geocoder and is
> provider-chained. `backend/CLAUDE.md` states geo-tracker "never resolves an address"; that is
> false as written (these two routes exist and are live), and true in the sense that matters —
> address resolution for orders and profiles is jovi-mall's alone.

---

### POST /routing/route

**Body**:
```json
{
  "origin":      { "latitude": 4.05, "longitude": 9.70 },
  "destination": { "latitude": 4.06, "longitude": 9.71 },
  "waypoints":   [ { "latitude": 4.055, "longitude": 9.705 } ]
}
```
`waypoints` is optional.

**Response** (`200`):
```json
{
  "distanceMeters": 2300.4,
  "durationSeconds": 540.2,
  "geometry": [ { "latitude": 4.05, "longitude": 9.70 }, { "latitude": 4.06, "longitude": 9.71 } ]
}
```
`geometry` is the decoded route line (may be empty if the provider returned none).

---

### POST /routing/eta

Convenience wrapper over a route, returning just time/distance to arrival.

**Body**: `{ "origin": {...}, "destination": {...} }`

**Response** (`200`):
```json
{ "distanceMeters": 2300.4, "durationSeconds": 540.2, "calculatedAt": "2026-07-15T09:41:00Z" }
```

---

### POST /routing/matrix

Pairwise distances/durations between every source and every target.

**Body**:
```json
{
  "sources": [ { "latitude": 4.05, "longitude": 9.70 } ],
  "targets": [ { "latitude": 4.06, "longitude": 9.71 }, { "latitude": 4.07, "longitude": 9.72 } ]
}
```

**Response** (`200`) — `cells[i][j]` is `sources[i]` → `targets[j]`:
```json
{ "cells": [ [ { "DistanceMeters": 10, "DurationSeconds": 1 },
               { "DistanceMeters": 20, "DurationSeconds": 2 } ] ] }
```

An empty `sources` or `targets` returns `{"cells":[]}` without calling the provider.

---

### GET /routing/geocode?q=...

**Response** (`200`) — best match first:
```json
{ "places": [ { "Position": { "latitude": 4.05, "longitude": 9.70 },
                "FormattedAddress": "Douala, Cameroon" } ] }
```

---

### GET /routing/reverse-geocode?lat=..&lng=..

**Response** (`200`):
```json
{ "Position": { "latitude": 4.05, "longitude": 9.70 }, "FormattedAddress": "Douala, Cameroon" }
```

---

## Errors

| Status | `error.code` | `error.category` | Meaning |
|---|---|---|---|
| `400` | `REQUEST_BODY_INVALID` | `validation` | Malformed body, missing `q`, or invalid `lat`/`lng` |
| `401` | `AUTH_MISSING_TOKEN` · `AUTH_TOKEN_INVALID` | `authentication` | Missing/invalid token |
| `429` | `RATE_LIMIT_EXCEEDED` | `rate_limit` | 600/min per IP — see [rate-limits.md](./rate-limits.md) |
| `501` | `ROUTING_CAPABILITY_UNSUPPORTED` | `business_rule` | The active provider lacks this capability (OSRM geocoding). **Do not retry.** |
| `502` | `ROUTING_PROVIDER_FAILED` | `external_service` | The upstream provider failed or returned no result. Message is generic; quote the `requestId`. |

Codes verified against `internal/platform/apperror/codes.go:64-65,88-95` on 2026-08-24. The body
is the shared envelope in every case — see [errors/README.md](./errors/README.md), and the
correction under the capability matrix above.

---

## ETA on the broadcast path (and its throttle)

The routing endpoints above are called explicitly. There is a second, implicit
consumer: the tracking broadcaster enriches a `location_broadcast` with
`etaSeconds` / `distanceMeters` whenever a destination is known for the watcher.

**That path used to be nearly cold and no longer is.** Its only source of a
destination was the optional `destination` on a viewer's `subscribe` frame, so in
practice only purpose-built customer clients reached it. A session now carries the
shipment's geocoded drop-off, pulled from jovi-mall — so **every** watcher of an
agent with an open delivery has one, agencies and admins included.

Left alone, the load would be **fixes × watchers** routing calls, and nothing under
`internal/modules/routing` caches anything. `ETA_MIN_INTERVAL` is the floor.

| | |
|---|---|
| Variable | `ETA_MIN_INTERVAL` |
| Default | `30s` |
| Scope | per `(agentID, destination)`, destination rounded to ~10 m |
| `0` | disables the cache — one provider call per watcher per fix, the pre-existing behaviour |

Three properties worth knowing before tuning it:

- **The key excludes the agent's own position.** It changes with every fix, so
  including it would make every lookup a miss and the cache a memory leak with
  extra steps. Movement inside the window is what the interval trades away.
- **Two watchers of one delivery share one call.** That is the point of keying on
  the destination rather than on the watcher.
- **A provider failure serves the last estimate rather than dropping the ETA.**
  A field that vanishes and reappears is worse for a client than one that lags.
  With nothing cached there is simply no ETA, exactly as before.

The cache is **per instance and in memory**, so provider load scales with instance
count. That is fine at the current one-host shape (`../docs/ADR-019-RELEASE-SHAPE.md`
D-1) and is the thing to revisit if this service is ever scaled out.
