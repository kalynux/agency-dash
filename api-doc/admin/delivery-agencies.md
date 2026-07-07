# Admin Delivery Agencies API

Admin-facing endpoints to manage delivery agency accounts. There is no hard delete —
"deactivating" an agency flips its `status` to `inactive` (agencies are referenced by
historical orders/shipments and can't be safely removed).

## Base Path
```
/api/admin
```

## Authentication
All requests require a valid Bearer token with the **admin** role:
```
Authorization: Bearer <access_token>
```

---

## Endpoints summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/delivery-agencies` | List all agencies (any status), paginated |
| GET | `/api/admin/delivery-agencies/:id` | Get one agency by id |
| PATCH | `/api/admin/delivery-agencies/:id/deactivate` | Deactivate an agency |
| PATCH | `/api/admin/delivery-agencies/:id/reactivate` | Reactivate an agency |

---

## Deactivation cascade — what actually happens

A vendor's **default delivery agency** (`Vendor.default_delivery_agency_id`) is a hard
prerequisite for selling physical products — a physical product can never reach `active`
status unless the vendor's default agency exists and is currently `active` (see
[Catalog: Product Status](../vendor/product-upload-flow.md)). This applies even to products
that have their own product-level delivery-agency override; that override only affects
order-time fulfillment routing, not eligibility to go live.

**`PATCH /:id/deactivate`**:
1. Sets the agency's `status` to `inactive`.
2. Finds every vendor whose `default_delivery_agency_id` currently points at this agency.
3. For each of those vendors, suspends **all** of their physical products — regardless of
   current status (draft, active, pending_review, archived) — moving each to `status:
   "suspended"` and individually snapshotting its own prior status so it can be restored
   exactly later. Already-suspended products are left untouched.

**`PATCH /:id/reactivate`**:
1. Sets the agency's `status` back to `active`.
2. For every vendor whose default is this agency, restores physical products that were
   suspended specifically because of a default-delivery-agency removal — each back to its
   own individually-saved previous status (draft → draft, active → active, etc.). Products
   suspended for any other reason are left alone.

Both actions are **idempotent** — deactivating an already-inactive agency (or reactivating
an already-active one) is a no-op that returns the current state with an empty affected list.

A vendor can also independently clear the suspension by switching to a **different active**
default agency via `PUT /api/vendor/profile/default-delivery-agency` — see
[Vendor Profile](../vendor/profile.md#put-apivendorprofiledefault-delivery-agency). Vendors
cannot clear their default to null themselves; deactivation by an admin is the only way a
default becomes unset.

---

### GET /api/admin/delivery-agencies

**Description**: List every delivery agency, including `inactive` and
`pending_verification` ones (unlike the vendor-facing agency browser).

**Query Parameters**:
| Param | Type | Notes |
|---|---|---|
| `status` | `'active' \| 'pending_verification' \| 'inactive'` | Optional filter |
| `page` | `number` | Default `1` |
| `limit` | `number` | Default `20`, max `50` |

**Success Response** — `200 OK`:
```json
{
  "success": true,
  "data": [
    {
      "id": "683abc1234567890abcdef01",
      "userId": "683abc1234567890abcdef00",
      "agencyName": "Swift Deliveries Cameroon",
      "logoUrl": "https://cdn.example.com/logos/swift-deliveries.png",
      "status": "active",
      "onboardingStep": 0,
      "createdAt": "2026-01-10T08:00:00.000Z",
      "updatedAt": "2026-06-01T12:30:00.000Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

### GET /api/admin/delivery-agencies/:id

**Success Response** — `200 OK`: same item shape as the list endpoint.

**Error Responses**: `404 DELIVERY_AGENCY_NOT_FOUND`.

---

### PATCH /api/admin/delivery-agencies/:id/deactivate

**Description**: Deactivate the agency and cascade-suspend affected vendors' physical
products (see above). No request body.

**Success Response** — `200 OK`:
```json
{
  "success": true,
  "data": {
    "id": "683abc1234567890abcdef01",
    "userId": "683abc1234567890abcdef00",
    "agencyName": "Swift Deliveries Cameroon",
    "logoUrl": "https://cdn.example.com/logos/swift-deliveries.png",
    "status": "inactive",
    "onboardingStep": 0,
    "createdAt": "2026-01-10T08:00:00.000Z",
    "updatedAt": "2026-07-07T09:00:00.000Z"
  },
  "message": "Agency deactivated. 14 product(s) suspended."
}
```

**Error Responses**: `404 DELIVERY_AGENCY_NOT_FOUND`.

---

### PATCH /api/admin/delivery-agencies/:id/reactivate

**Description**: Reactivate the agency and cascade-restore affected vendors' physical
products suspended for this reason (see above). No request body.

**Success Response** — `200 OK`:
```json
{
  "success": true,
  "data": {
    "id": "683abc1234567890abcdef01",
    "userId": "683abc1234567890abcdef00",
    "agencyName": "Swift Deliveries Cameroon",
    "logoUrl": "https://cdn.example.com/logos/swift-deliveries.png",
    "status": "active",
    "onboardingStep": 0,
    "createdAt": "2026-01-10T08:00:00.000Z",
    "updatedAt": "2026-07-07T10:00:00.000Z"
  },
  "message": "Agency reactivated. 14 product(s) restored."
}
```

**Error Responses**: `404 DELIVERY_AGENCY_NOT_FOUND`.
