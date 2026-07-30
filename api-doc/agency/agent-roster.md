# Agency — Agent Roster

## Base Path

```
/api/agency/agents
```

## Authentication

**Authorization**: Agency access required. Bearer token with `agency` role.

All endpoints are scoped to the calling agency. A membership belonging to another agency reports
`404`, never `403` — an agency must not be able to probe whether an agent works for a rival.

---

## Model

An agent is a **platform identity**, not an agency-owned record: the same agent may serve several
agencies. Your relationship with one is a **membership**, and everything you decide about that agent
lives on it — approval state, employment terms, COD cap. Nothing you set affects that agent at
another agency.

Two ways an agent joins you:

| Path | You do | Agent does | Result |
|---|---|---|---|
| **Invitation** | invite their email | accepts | `approved` immediately |
| **Join request** | approve | applies | `pending` → `approved` |

### Lifecycle

```
pending ──approve──> approved <──reinstate── suspended
   │                    │  │                     │
   └──decline──> removed <┴──remove─────────────-┘
```

**Suspend vs. remove** — the distinction matters operationally:

| | Suspend | Remove |
|---|---|---|
| New assignments | blocked | blocked |
| Shipments in flight | **kept, agent works them** | must be zero first |
| Undeposited COD cash | irrelevant | must be zero first |
| Reversible | yes (reinstate) | no (they must re-join) |

Suspension is deliberately **not** blocked by in-flight work: suspending someone is what you reach
for when they must stop taking new jobs *right now*, and requiring an empty queue would make it
useless in the moment it matters.

---

### POST /api/agency/agents/invites

**Request Body**: `{ "email": "agent@example.com" }`

**Success Response** (`201 Created`):
```json
{
  "success": true,
  "data": {
    "id": "665f1f77bcf86cd799439200",
    "email": "agent@example.com",
    "status": "pending",
    "createdAt": "2026-07-10T09:00:00.000Z"
  },
  "message": "Invite sent. The agent will see it once signed up with this email."
}
```

**Errors**:
- `409` – `DELIVERY_INVITE_ALREADY_PENDING` – `details: { inviteId }`.
- `409` – `AGENT_MEMBERSHIP_ALREADY_EXISTS` – they already have a live membership **with you**.

> An agent already serving another agency **is a valid invitee**. Only a live membership with *your*
> agency blocks the invite.

### GET /api/agency/agents/invites

**Query**: `status?` – `pending` | `accepted` | `declined` | `revoked`

### DELETE /api/agency/agents/invites/:id

Revoke a pending invite.

---

### GET /api/agency/agents

**Description**: Your roster — memberships joined to their agent records, with cash held.

**Query**: `status?` – `pending` | `approved` | `suspended` | `removed`. Omitted returns all live
memberships.

**Success Response** (`200 OK`):
```json
{
  "success": true,
  "data": [
    {
      "membership": {
        "id": "665f1f77bcf86cd799439300",
        "agentId": "507f1f77bcf86cd799439011",
        "agencyId": "507f1f77bcf86cd799439099",
        "status": "approved",
        "origin": "invitation",
        "isPrimary": true,
        "employment": {
          "employmentType": "contractor",
          "employeeRef": "EMP-042",
          "startedAt": "2026-01-05T00:00:00.000Z",
          "endsAt": null
        },
        "codMaxExposureOverride": 500000,
        "approvedAt": "2026-01-05T00:00:00.000Z",
        "suspendedAt": null,
        "suspensionReason": null
      },
      "agent": {
        "id": "507f1f77bcf86cd799439011",
        "name": "Jean Kamga",
        "email": "agent@example.com",
        "phone": "+237670000001",
        "avatar": null,
        "status": "active",
        "vehicleInfo": { "vehicle_type": "bike", "plate_number": "ABC-123", "color": "red" },
        "availability": "online",
        "workingState": "working",
        "activeShipmentCount": 3,
        "trackingAllowed": true,
        "trustScore": 100
      },
      "cashHeld": 125000
    }
  ]
}
```

`activeShipmentCount` counts the agent's shipments **across all agencies** — capacity is a property
of the person and their vehicle, not of your view of them.

> **⚠️ Behaviour change (2026-07-29):** `activeShipmentCount` now reports the **same counter the
> dispatcher admits against** (`capacity.active_shipment_count`, which is atomically
> checked-and-incremented when an agent accepts an offer). It previously read a parallel, recomputed
> counter that could lag it — so a roster row could show room while an accept failed with
> `AGENT_AT_CAPACITY`, or vice versa. Expect this number to occasionally differ from what the old
> response returned; the new one is the authoritative one.
>
> `workingState` (`idle` / `working` / `at_capacity`) is still the derived label and is unchanged.

### GET /api/agency/agents/:membershipId

Full detail: the membership plus the agent's complete profile.

---

### POST /api/agency/agents/:membershipId/approve

Approve a pending join request.

**Errors**:
- `409` – `AGENT_MEMBERSHIP_ALREADY_APPROVED`.
- `409` – `AGENT_MEMBERSHIP_NOT_PENDING` – `details: { status }`. Also returned when you lose a race
  with another approver.
- `422` – `AGENT_MEMBERSHIP_LIMIT_REACHED` – the agent is at their agency cap.

### POST /api/agency/agents/:membershipId/decline

**Request Body**: `{ "reason": "Outside coverage area" }` (optional)

---

### POST /api/agency/agents/:membershipId/suspend

**Request Body**: `{ "reason": "Repeated late deposits" }` — **required**.

**Success Response** (`200 OK`):
```json
{
  "success": true,
  "data": { "id": "665f...", "status": "suspended", "suspensionReason": "Repeated late deposits" },
  "message": "Agent suspended. They keep current shipments but receive no new ones."
}
```

**Errors**: `409` – `AGENT_MEMBERSHIP_NOT_APPROVED` – `details: { status }`.

### POST /api/agency/agents/:membershipId/pause

**Request Body**: `{ "reason": "Slow season" }` (optional)

The softer sibling of suspend. Both stop new assignments and leave in-flight shipments alone; the
difference is meaning and symmetry — `paused` reads as a mutual break, `suspended` as a sanction,
and `pause` is the only one of the two the **agent** may also raise (with your agreement).
`reinstate` returns from either.

**Errors**: `409` – `CONTRACT_INVALID_TRANSITION` – only an `active` contract can be paused.
`details: { transition, from, allowedFrom }`.

---

### POST /api/agency/agents/:membershipId/reinstate

**Errors**: `409` – `AGENT_MEMBERSHIP_NOT_SUSPENDED` – `details: { status }`.

---

### DELETE /api/agency/agents/:membershipId

**Request Body**: `{ "reason": "Contract ended" }` (optional)

**This proposes termination; it does not perform it.** Ending a contract is not one party's call, so
this raises a `ContractStatusRequest` for the agent to clear, and the contract stays live meanwhile.
`membership` is `null` while the request is pending — which, on this first call, it always is.

**Success Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "request": {
      "id": "507f1f77bcf86cd799439055",
      "contractId": "507f1f77bcf86cd799439011",
      "transition": "deactivate",
      "targetStatus": "deactivated",
      "fromStatus": "active",
      "state": "pending",
      "requestedByRole": "agency",
      "blockingConditions": { "outstandingCod": 50000, "outstandingPayment": 0, "clear": false }
    },
    "membership": null
  },
  "message": "Removal requested. The contract ends once the agent agrees and any cash and unpaid earnings are settled."
}
```

`blockingConditions` is `null` when nothing is in the way. It is advisory at this point: the same
conditions are **re-checked when the request is approved**, never trusted from when it was raised —
cash can be collected in between.

**Errors**:
- `404` – `CONTRACT_NOT_FOUND`.
- `409` – `CONTRACT_STATUS_REQUEST_ALREADY_PENDING` – `details: { requestId }`. One open deactivation
  per contract; two simultaneous proposals are one intent.
- `409` – `CONTRACT_INVALID_TRANSITION` – the contract is already `deactivated` or `rejected`.

On **approval** (not here), termination is refused while either side still owes the other:
- `422` – `CONTRACT_HAS_OUTSTANDING_COD` – `details: { outstandingCod, hint }`. Scoped to **this**
  contract: cash the agent owes another agency is none of your business.
- `422` – `CONTRACT_HAS_UNPAID_EARNINGS` – `details: { outstandingPayment, hint }`. You must pay the
  agent for work under this contract first.

Once both are zero, termination is immediate — there is deliberately no notice period. If the
deactivated contract was the agent's primary, another active contract is promoted automatically.

---

### PATCH /api/agency/agents/:membershipId/employment

**Request Body** (all optional; at least one required):
```json
{
  "employment_type": "employee",
  "employee_ref": "EMP-042",
  "started_at": "2026-01-05",
  "ends_at": null
}
```

`employment_type`: `employee` | `contractor` | `freelancer`. `ends_at` must not precede `started_at`.
`employee_ref` is *clearable*: `null` or `""` clears it (stored as `null`); omit to leave unchanged.

Employment is **per-membership**: the same agent may be your employee and another agency's freelancer.

> A thin alias for `PATCH .../terms` below, kept because it predates it. New integrations should use
> `/terms`, which reaches every negotiated field including the fee split.

---

### PATCH /api/agency/agents/:membershipId/terms

**Description**: Update the negotiated terms of a contract. All groups optional; at least one
required. Each group is merged field-by-field, so an omitted key keeps its value.

**Request Body**:
```json
{
  "fee_split": { "model": "percentage", "agent_share_percent": 40, "currency": "XAF" },
  "remittance_terms": { "cadence": "daily", "grace_hours": 24 },
  "coverage": { "regions": ["Douala", "Bonabéri"] },
  "shipment_value_ceiling": 250000
}
```

| Group | Fields |
|---|---|
| `employment` | `employment_type` (`employee`\|`contractor`\|`freelancer`), `employee_ref` *(clearable)*, `started_at`, `ends_at` |
| `remittance_terms` | `cadence` (`per_delivery`\|`daily`\|`weekly`\|`biweekly`\|`monthly`\|`on_demand`), `day_of_week` (0–6, weekly/biweekly), `day_of_month` (1–28), `grace_hours` (0–720) |
| `coverage` | `regions` (≤100 names), `area` (GeoJSON `Polygon` or `null`) |
| `fee_split` | `model` (`percentage`\|`flat`), `agent_share_percent` (0–100), `agent_flat_fee` (minor units), `currency` (3 letters) |
| `shipment_value_ceiling` | integer minor units, or `null` for no per-shipment cap |

> **`fee_split` is what pays the agent.** The earnings split divides by it twice — once for the
> agent's offer-time estimate, once for the actual at delivery — so it is validated for coherence
> up front rather than mispaying weeks later: a `percentage` model must end up with an
> `agent_share_percent`, a `flat` model with an `agent_flat_fee`. The patch is merged over the
> stored split before checking, so switching only `model` on a contract that already carries the
> other value is fine.
>
> **The agent's cut comes OUT of your delivery fee, never on top.** The vendor pays the same either
> way. You owe it; the platform pays it, through the agent's own earnings account.

> **`cod.threshold` is not settable here** — it is bounded by the agent's shared pool and has its
> own endpoint below.

**Errors**:
- `404` – `CONTRACT_NOT_FOUND` – unknown, or not on your roster.
- `422` – `CONTRACT_FEE_SPLIT_INVALID` – the resulting split has no value for its model.
  `details: { model, hint }`.

---

### GET /api/agency/agents/status-requests

**Description**: Contract changes an **agent** has raised that are waiting on your decision — a
pause, a reactivation, or a departure. Newest first.

Declared before `/:membershipId`, so `status-requests` is never read as a membership id.

**Success Response** (`200 OK`): an array of status requests, same shape as the `request` object
returned by `DELETE /api/agency/agents/:membershipId` above.

---

### POST /api/agency/agents/status-requests/:requestId/resolve

**Description**: Approve or reject a request the agent raised.

**Request Body**:
```json
{ "decision": "approve", "note": "Agreed" }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `decision` | string | ✅ | `approve` or `reject` |
| `note` | string \| null | ❌ | ≤300 chars |

**You cannot resolve a request you raised.** Your own removal proposal is cleared by the *agent*,
from their inbox — that mutual consent is the whole point of the two-party transitions.

**Errors**:
- `403` – `CONTRACT_STATUS_REQUEST_NOT_YOURS` – you raised it; the agent must resolve it.
- `404` – `CONTRACT_STATUS_REQUEST_NOT_FOUND` – unknown, or not addressed to your agency.
- `409` – `CONTRACT_STATUS_REQUEST_NOT_PENDING` – already resolved. `details: { state }`.
- `409` – `CONTRACT_INVALID_TRANSITION` – the contract moved since the request was raised.
- `422` – `CONTRACT_HAS_OUTSTANDING_COD` / `CONTRACT_HAS_UNPAID_EARNINGS` – on approving a departure
  while either side still owes the other.

---

### GET /api/agency/agents/:membershipId/settlements

**Description**: This contract's cash history and what is still outstanding under it.

**Query Parameters**: `page` (default 1), `limit` (default 20, max 100).

**Success Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "membershipId": "507f1f77bcf86cd799439011",
    "cod": {
      "threshold": 200000,
      "outstandingBalance": 45000,
      "lifetimeSettled": 1250000,
      "lastSettledAt": "2026-07-26T17:30:00.000Z"
    },
    "deposits": [
      {
        "id": "665f1f77bcf86cd799439600",
        "amount": 80000,
        "recipient": "agency",
        "status": "confirmed",
        "declaredAt": "2026-07-26T16:00:00.000Z",
        "confirmedAt": "2026-07-26T17:30:00.000Z"
      }
    ]
  },
  "meta": { "total": 12, "page": 1, "limit": 20 }
}
```

> A projection of the deposits already recorded in [cod-cash-management.md](./cod-cash-management.md),
> scoped to this one contract — not a separate ledger. `outstandingBalance` is the number that must
> reach zero before the contract can be deactivated.

**Errors**: `404` – `CONTRACT_NOT_FOUND` – unknown, or not on your roster.

---

### PATCH /api/agency/agents/:membershipId/cod-limit

**Request Body**: `{ "threshold": 500000 }` — minor units. Not nullable: `0` grants nothing, and is
the default.

**Success Response** (`200 OK`):
```json
{
  "success": true,
  "data": { "membershipId": "507f1f77bcf86cd799439011", "threshold": 500000, "headroomAfter": 200000 },
  "message": "COD threshold updated."
}
```

**A sub-allocation, not an independent cap.** This contract's threshold is a slice of the agent's own
global COD pool (`cod.max_threshold`), and the sum across their allocating contracts — `active`,
`paused` and `suspended` — may never exceed it. So a raise here can be refused because of a *different*
agency's slice, and `headroomAfter` reports what is left of the pool so you learn your room without a
second request.

Trust score, by contrast, is platform-wide — the agent holds one pot of cash whoever dispatched it, so
trust follows the person.

**Errors**:
- `404` – `CONTRACT_NOT_FOUND` – no such contract on your roster.
- `422` – `CONTRACT_COD_THRESHOLD_OUT_OF_BOUNDS` – outside the absolute per-contract bounds.
  `details: { requested, min, max }`.
- `422` – `CONTRACT_COD_THRESHOLD_EXCEEDS_HEADROOM` – the agent's pool has no room.
  `details: { requested, headroom, shortfall, hint }`. The agent must raise their global threshold, or
  another contract must free capacity.
- `422` – `CONTRACT_COD_THRESHOLD_BELOW_OUTSTANDING` – you cannot set a threshold beneath cash the
  agent already holds under this contract. `details: { requested, outstandingBalance, hint }`.

---

### GET /api/agency/agents/eligible

**Description**: The agents you can dispatch **right now**, already filtered.

Returns roster-entry objects (the `agent` shape above).

### GET /api/agency/agents/:agentId/eligibility

**Description**: Why one agent can or cannot be assigned right now.

**Success Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "agentId": "507f1f77bcf86cd799439011",
    "agencyId": "507f1f77bcf86cd799439099",
    "eligible": false,
    "reasons": ["not_available", "at_capacity"],
    "rules": [
      { "rule": "active", "passed": true, "reason": null, "observed": { "status": "active" } },
      { "rule": "approved", "passed": true, "reason": null, "observed": { "membershipStatus": "approved" } },
      { "rule": "available", "passed": false, "reason": "not_available", "observed": { "availability": "on_break" } },
      { "rule": "tracking_allowed", "passed": true, "reason": null, "observed": { "allowed": true, "reason": null } },
      { "rule": "device_location", "passed": true, "reason": null, "observed": { "enabled": null, "provider": "self_reported", "required": false, "unknownPolicy": "allow" } },
      { "rule": "capacity", "passed": false, "reason": "at_capacity", "observed": { "activeShipmentCount": 5, "max": 5 } }
    ],
    "activeShipmentCount": 5,
    "maxConcurrentShipments": 5
  }
}
```

> `maxConcurrentShipments` here is the eligibility result's name for the agent's
> `capacity.max_active_shipments` — the plan-driven ceiling. There is no
> `settings.max_concurrent_shipments` field; that name was retired when capacity moved onto its own
> sub-document.

**Every** failing rule is reported, not just the first — a dispatcher shouldn't have to fix blockers
one at a time. `observed` shows what each rule actually saw, so a denial is explainable without
re-running anything.

**Reasons**: `agent_not_found`, `agent_not_active`, `membership_not_approved`, `not_available`,
`tracking_not_allowed`, `device_location_disabled`, `device_location_unknown`, `at_capacity`.

The same rules are enforced when you call
[`PATCH /api/agency/shipments/:id/assign-agent`](./shipments.md), which fails with
`422 AGENT_NOT_ELIGIBLE_FOR_ASSIGNMENT` carrying `details: { reasons, rules }`.

---

### GET /api/agency/agents/:agentId/history

One agent's membership trail **within your agency**.

### GET /api/agency/agents/history

The whole roster's trail, newest first.

Event types: `invited`, `invite_accepted`, `invite_declined`, `invite_revoked`, `join_requested`,
`approved`, `request_declined`, `suspended`, `reinstated`, `removed`, `transferred_out`,
`transferred_in`, `primary_changed`, `employment_updated`, `terms_updated`, `cod_limit_changed`.

---

## Transfers

Moving an agent between agencies is **admin-only** — an agency must not be able to pull an agent off
a rival's roster. See `POST /api/admin/agents/transfer`.
