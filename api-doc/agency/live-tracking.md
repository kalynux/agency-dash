# Agency — Live Tracking

> **Verified against source 2026-08-24 (PLAN-3).** Every field of the response below was
> read off `src/modules/tracking-integration/services/agency-tracking-board.service.ts:34-142`
> (the `TrackingBoard*` interfaces and `buildTrackingBoard`), the agent set off
> `…/services/visible-agents.service.ts:25-52` (`TRACKABLE_SHIPMENT_STATUSES` and
> `trackableShipmentsForAgency`), the route and guard off
> `src/modules/delivery/agency.routes.ts:15-16,199` and the cap off
> `…/config/tracking-integration.config.ts:45` (`TRACKING_BOARD_MAX_SHIPMENTS`, default
> **200**). All matched.
>
> **One correction was applied**: step 7 of *Drawing the map* told you a
> `permission_revoked` frame means "the shipment finished". It does not — that is the single
> reading the closed three-value `reason` set exists to prevent, and it was the most
> consequential stale sentence in this repository's tracking docs.

The agency live-tracking map is served by **two** services, and the split is the
point:

| | Service | Carries |
|---|---|---|
| **What to draw** | jovi-mall (this doc) | which agents you may watch, and each of their active shipments with its **start** and **end** pins |
| **What moves** | geo-tracker | the agent's live position, over a WebSocket |

jovi-mall owns the shipment/order model, so it owns the addresses. geo-tracker
owns live positions and road networks. Neither grows a copy of the other's data.

**This endpoint never returns a position.** The agent's last known position is
mirrored onto their profile for business purposes but is stale by construction —
serving it here would put a plausible-looking marker on a map that has stopped
moving. Positions come only from the socket.

---

## GET /api/agency/tracking/board

**Auth**: agency (cookie or `Authorization: Bearer <jwt>`).

The whole map in one call. No pagination — this is a live snapshot, not a list.

### Which agents appear

Exactly the agents this agency may currently track: those assigned to one of its
shipments in `assigned`, `handing_over`, `picked_up`, `in_transit` or
`agent_delivered`. That is the same set
[`GET /api/tracking/visible-agents`](../tracking/live-tracking.md) returns, and
geo-tracker gates the WebSocket subscription on that policy — so every agent on
this board is guaranteed subscribable, and no agent you are entitled to watch is
missing from it.

Two consequences worth knowing:

- **A shipment offered but not yet accepted does not appear.** It has no agent
  bound to it, so there is nobody to track. It shows up the moment the agent
  accepts.
- **An idle agent does not appear**, even one on your roster who is online. An
  agency's visibility derives from shipments, not the roster.

### Success (200)

```json
{
  "success": true,
  "data": {
    "agents": [
      {
        "agentId": "507f1f77bcf86cd799439101",
        "name": "Awa Ngassa",
        "avatar": {
          "id": "665f1f77bcf86cd799439fff",
          "key": "avatars/awa.png",
          "url": "https://…/avatars/awa.png",
          "access": "public",
          "mimeType": "image/png",
          "size": 20481,
          "originalName": "awa.png"
        },
        "phone": "+237670000003",
        "vehicleType": "bike",
        "shipments": [
          {
            "shipmentId": "507f1f77bcf86cd799439100",
            "trackingNumber": "FDO-260802-090000-K7Q2M",
            "orderNumber": "ORD-2026-000123",
            "status": "in_transit",
            "itemCount": 2,
            "origin": {
              "address": {
                "label": "Acme Warehouse",
                "formattedAddress": "12 Rue Njo-Njo, Bonapriso, Douala, Littoral, Cameroon",
                "addressLine1": "12 Rue Njo-Njo",
                "addressLine2": null,
                "city": "Douala",
                "state": "Littoral",
                "country": "Cameroon",
                "coordinates": { "lat": 4.0421, "lng": 9.7085 }
              },
              "mode": "pickup_based",
              "count": 1
            },
            "destination": {
              "label": "Home",
              "formattedAddress": "Carrefour Ndokotti, Douala, Littoral, Cameroon",
              "addressLine1": "Carrefour Ndokotti",
              "addressLine2": null,
              "city": "Douala",
              "state": "Littoral",
              "country": "Cameroon",
              "coordinates": { "lat": 4.0611, "lng": 9.7359 }
            },
            "mappable": true,
            "createdAt": "2026-08-02T09:00:00.000Z",
            "updatedAt": "2026-08-02T11:20:00.000Z"
          }
        ]
      }
    ],
    "meta": { "agentCount": 1, "shipmentCount": 1, "truncated": false }
  }
}
```

An agency with nothing in flight gets `200` with `agents: []`. "Nothing to track
right now" is an answer, not a missing resource.

### Fields

| Field | Notes |
|---|---|
| `agents[].agentId` | Use this verbatim as the `agentId` in geo-tracker's `subscribe` frame. |
| `agents[].avatar` | The standard file object `{ id, key, url, mimeType, size, originalName }`, or `null`. Never a bare URL string. |
| `agents[].shipments` | Newest first. An agent running several deliveries has several entries — geo-tracker opens one tracking session per shipment, all fed by the agent's single GPS stream. |
| `origin` | **The start pin.** Where the parcel is collected: the vendor's business address, this agency's HQ, or — after a reassignment — the handover point. `mode` is `pickup_based` \| `storage_based` \| `mixed` \| `null`; `count > 1` means there are further collection points, which [`GET /api/agency/shipments/:id`](./shipments.md#detail) lists in full. |
| `destination` | **The end pin.** The customer address geocoded at checkout, snapshotted onto the order. Deliberately *not* the customer's current saved address — reading that live would silently re-route a delivery already on the road. |
| `mappable` | Both ends have coordinates, so the delivery can be drawn. |
| `meta.truncated` | The agency has more trackable shipments than the server cap (`TRACKING_BOARD_MAX_SHIPMENTS`, default 200) and the board was cut. |

**`mappable: false` is not an error.** Legacy orders created before the geocoded
drop-off existed, and vendor addresses that were never geocoded, genuinely have
no coordinates. Both fields are still returned so the row reads as text — show
the address, skip the pin.

`status` uses the shipment lifecycle documented in [shipments.md](./shipments.md).
Note `handing_over` belongs here: a picked-up parcel being reassigned is still on
the road, and the replacement agent is tracked from the moment they accept.

---

## Drawing the map

1. `GET /api/agency/tracking/board` → the agent list and their shipments.
2. Open geo-tracker's socket `GET /ws/track`, authenticating with the **same**
   access token (httpOnly cookie, or `Sec-WebSocket-Protocol: bearer, <token>`).
3. Subscribe per agent you are showing:
   ```json
   { "type": "subscribe", "payload": { "agentId": "507f1f77bcf86cd799439101" } }
   ```
   Every `location_broadcast` frame then moves that agent's marker.
4. On selecting a shipment, plot `origin.address.coordinates` and
   `destination.coordinates`.
5. **Live ETA to the selected shipment.** Prefer **`shipmentId`** — the server resolves the
   drop-off from that shipment's own tracking session, so you do not have to hand a
   customer's coordinates to another service:
   ```json
   { "type": "subscribe",
     "payload": { "agentId": "507f1f77bcf86cd799439101",
                  "shipmentId": "507f1f77bcf86cd799439100" } }
   ```
   Sending `destination` still works and is an **override** — nothing replaces it for the
   life of the subscription, and it is per-subscription rather than persisted, so send it
   again after a reconnect. **Sending neither now also yields an ETA** when the agent has
   exactly one open session; with several deliveries in flight the server declines rather
   than guessing. Full resolution table:
   [geo-tracker/tracking-websocket.md § How the destination is resolved](../geo-tracker/tracking-websocket.md#how-the-destination-is-resolved).
6. **Road line between the two pins** (optional) — geo-tracker's
   `POST /routing/route` with `{ origin, destination }`. Without it, a straight
   line between the two pins is a reasonable fallback. ⚠ On the default
   `ROUTING_PROVIDER=osrm` this works; `/routing/geocode` on the same service does **not**
   — see [geo-tracker/routing.md](../geo-tracker/routing.md).
7. 🔴 **A `permission_revoked` frame does not mean the delivery finished.** Read
   `payload.reason` first — it is a **closed set of three** and only
   `shipment_completed` is about a delivery:

   | `reason` | What it means here | What the board should do |
   |---|---|---|
   | `shipment_completed` | jovi-mall was asked and said this agency is no longer entitled to that agent. | Drop the marker, refetch the board. **The only value from which you may show "delivered".** |
   | `authorization_expired` | The token the socket was opened with was rejected. Nothing is known about the shipment. | Reconnect with a fresh token and re-subscribe. **Say nothing about the delivery.** Keep the row; it is almost certainly still in flight. |
   | `authorization_unavailable` | jovi-mall could not be asked. Nothing is known. | Retry with backoff. Report no outcome. |

   Treat any unrecognised value as `authorization_expired`. Until 2026-08-19 all three were
   sent as `shipment_completed`, which is how a dashboard came to tell an operator a delivery
   had completed because an access token aged out.

### Refreshing

The board is a snapshot of *assignments*, which change on the order of minutes;
positions change on the order of seconds and arrive on the socket. Refetch the
board on a `permission_revoked` frame and otherwise on a slow poll — re-fetching
it per position update is pure waste.

geo-tracker being down costs you the moving markers and nothing else: the board
never calls it, so agents, shipments and both pins still render.
