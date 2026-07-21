# Error Responses

## HTTP endpoints

Errors are returned as **plain text** via Go's `http.Error`, not the structured
envelope jovi-mall uses:

```
HTTP/1.1 401 Unauthorized
Content-Type: text/plain; charset=utf-8

invalid or expired token
```

The exception is the routing module, which returns JSON:
`{"error":"active provider does not support geocode"}`.

**Branch on the HTTP status code**, not the body. Aligning on jovi-mall's
`{"success":false,"error":{"code",...}}` contract is a known gap — there are
not yet distinct domain error codes worth encoding here.

`X-Request-ID` is set on every response (generated, or echoed from an inbound
`X-Request-ID`) and logged server-side — quote it when reporting a problem.

## Status codes

| Status | Meaning | Where |
|---|---|---|
| `400` | Malformed request body/params | routing, webhook |
| `401` | Missing/invalid access token, or bad webhook signature | all authenticated routes |
| `403` | Authenticated but forbidden — a vendor opening a tracking socket | `/ws/track` |
| `404` | Not found **or** not authorized to see it (deliberately identical, so existence never leaks) | `/locations/{agentID}` |
| `500` | Unhandled panic (recovered), or a failed lookup/event processing | any |
| `501` | The active routing provider lacks this capability (e.g. OSRM geocoding) | `/routing/*` |
| `502` | An upstream failed: routing provider, or jovi-mall while verifying authorization (fails closed) | `/routing/*`, `/locations/*`, `/ws/track` |
| `503` | A required dependency isn't configured (e.g. webhook secret) or isn't reachable | `/webhooks/node`, `/readyz` |

## WebSocket

Errors after a successful handshake are **frames, not status codes**, and are
non-fatal — the connection stays open:

```json
{ "type": "error", "payload": { "message": "not authorized" } }
```

Handshake-time failures are ordinary HTTP statuses (`401`/`403`), since the
upgrade never completes. See [../tracking-websocket.md](../tracking-websocket.md).
