# Agency Inventory — **PROPOSED, NOT YET IMPLEMENTED**

> [!WARNING]
> **None of this exists on the backend yet.** This document is a *request*, written
> from the agency dashboard's Inventory screen (`/dashboard/inventory`), which is
> built and shipped against this contract. Until the endpoints below exist the
> screen renders its error state.
>
> This is not a thin read over existing data — see [§0 Why this needs new
> data](#0-why-this-needs-new-data). The single biggest ask is a **stock record
> with a location dimension**, which the platform does not currently have.

## Base Path

```
/api/agency/inventory
```

## Authentication

Bearer token (or cookie session) with the **agency** role. Every endpoint is
scoped to the authenticated agency — an agency can only ever read stock it holds.

> Related docs: [Magazin](./magazin.md) (the HQ addresses stock is placed at) ·
> [Shipments](./shipments.md) (`items[].pickupLocation.mode: "storage_based"`) ·
> [Products](./products.md) (the current flat product list) ·
> [Onboarding → policies](./onboarding.md) (`pricing.storage_based`) ·
> [Vendor Inventory](../vendor/inventory.md) (the vendor-side stock model this
> extends).

---

## 0. Why this needs new data

The dashboard needs three things per line: **what** we hold, **where** in our
network it sits, and **how much is left**. Today the platform can answer only the
first, and only partly.

| What the screen needs | What exists today | Verdict |
|---|---|---|
| Which SKUs an agency holds | Nothing. `delivery.pickup_location.source: "agency_storage"` on a product is a **routing flag** — "collect from the agency's HQ, not the vendor's shop". No record is created, no quantity is tracked. | **New** |
| Quantity per SKU | `ProductVariant.stock` — a single global scalar owned by the vendor. | **Needs a location dimension** |
| Quantity per location | Nothing. No warehouse/stock-level/bin model exists anywhere. | **New** |
| Which of our addresses holds it | `magazin.headquarters_addresses[]` exists and is `_id`-addressable, but **every consumer hardcodes `[0]`** — shipments, handover pickup, assignment candidates all read the first entry. A second warehouse is currently invisible to the platform. | **New link + fix `[0]`** |
| Reserved / available split | `StockReservation` exists, has no location, and is **never written** — the reservation/commit/release services are implemented but unwired. | **Needs wiring** |
| Movement history | `StockAuditLog` exists, is append-only, has **no location dimension**, and is only ever written by `PATCH /api/vendor/inventory/bulk-update`. Its `order` and `reservation` enum values are never emitted. | **Needs location + wiring** |

Two further findings worth flagging before any of this is designed:

1. **Stock is never decremented by the order or shipment pipeline.** Grepping
   `src/modules` for `stock` outside `catalog/` returns nothing relevant;
   `unpaid-order-cancel.worker.ts` states it outright ("Stock is not reserved at
   order creation"). So "amount left" is not merely *unlocated* today — for a
   storage-based line it is **not decremented at all** when goods leave our
   shelf. Fixing this is a prerequisite for the numbers on this screen to mean
   anything.
2. **`Shipment.items[]` carries `product_id` and `quantity` but no `variant_id`
   and no `sku`.** Stock lives on the *variant*. As things stand, a delivered
   shipment cannot tell you which variant left the warehouse, so the decrement in
   (1) cannot be implemented without adding `variant_id` to the shipment item.
   The order item already snapshots `variant_id` + `sku`, so the value is
   available at shipment-creation time.

### Business context — this is already billed for

`policies.pricing.storage_based.monthly_storage_fee_per_sku` is a per-SKU,
per-month rent an agency sets during onboarding. It is currently **never
charged** — `earnings-quote.service.ts` carries an explicit
`TODO(earnings): monthly_storage_fee_per_sku — intentionally EXCLUDED`, deferring
it to "a separate recurring job". That job cannot be written until something
records *which SKUs an agency stores*. The same record this screen reads is the
record that unblocks that billing.

---

## 1. Data model — the minimum new shape

The dashboard does not care how this is stored, only that the endpoints below can
be served. The smallest thing that works:

```ts
// collection: agency_stock_levels
{
  _id: ObjectId,
  agency_id:   ObjectId,   // ref DeliveryAgency — the scope of every query here
  location_id: ObjectId,   // an _id from magazin.headquarters_addresses[]
  vendor_id:   ObjectId,   // denormalised; every list query filters/groups by it
  product_id:  ObjectId,
  variant_id:  ObjectId | null,   // null for a product with no variants
  quantity:    Number,     // units of this variant at THIS location
  stored_since: Date,
  updated_at:  Date,
}
// unique index: { agency_id, location_id, variant_id }
// index:        { agency_id, vendor_id }
```

Notes on the shape:

- **The unit is the variant, not the product.** A product with three sizes is
  three lines, because three separate counts are what a warehouse holds and what
  `monthly_storage_fee_per_sku` bills. `SKU` is already globally unique
  (`ProductVariantSchema.index({ sku: 1 }, { unique: true })`), so it is a safe
  display key but **not** a safe grouping key across vendors — group by
  `variant_id`.
- **A line's `onHand` is the sum of its rows across locations.** Do not also
  store the total; a second copy of a number is a second thing to be wrong.
- `location_id` **must** be a real `magazin.headquarters_addresses[]._id`. The
  screen's location filter is built from the magazin the app already has loaded,
  so an id that isn't in that array filters to nothing.
- Movements want the same location dimension — either add
  `location_id` + `agency_id` to `StockAuditLog`, or add a parallel
  `agency_stock_movements` collection. Either is fine; §3 only needs the read.

---

## 2. `GET /api/agency/inventory`

One row per stored **variant**, aggregated across every location that holds it.

### Query parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `q` | string | — | Free text over product title, variant title, SKU, and vendor business name. Ignore anything under 2 characters (the client already does). |
| `locationId` | string | — | A `magazin.headquarters_addresses[]._id`. Returns lines with ≥1 unit **there**; `locations[]` still lists every location holding the line. |
| `vendorId` | string | — | Filter to one vendor. |
| `stockState` | enum | — | `in_stock` \| `low` \| `out_of_stock`. Omit for all. |
| `page` | integer | 1 | |
| `limit` | integer | 20 | Max 100. |

### Success `200`

```json
{
  "success": true,
  "data": [
    {
      "id": "66a1f0c2e4b0a1d2c3e4f501",
      "productId": "507f1f77bcf86cd799439066",
      "variantId": "507f1f77bcf86cd799439060",
      "title": "Blue T-Shirt",
      "variantTitle": "Black / M",
      "sku": "SHIRT-BLK-M",
      "image": {
        "id": "507f1f77bcf86cd799439030",
        "key": "products/2026/07/tshirt.jpg",
        "url": "https://cdn.example.com/products/tshirt.jpg",
        "mimeType": "image/jpeg",
        "size": 88110,
        "originalName": "tshirt-front.jpg"
      },
      "vendor": {
        "id": "507f1f77bcf86cd799439aaa",
        "businessName": "Acme Store",
        "phone": "+237670000001",
        "email": "acme@example.com"
      },
      "onHand": 42,
      "reserved": 3,
      "available": 39,
      "lowStockThreshold": 5,
      "stockState": "in_stock",
      "locations": [
        { "locationId": "6641abc123def457", "label": "Douala HQ",      "city": "Douala",  "region": "Littoral", "quantity": 30 },
        { "locationId": "6641abc123def458", "label": "Yaoundé Branch", "city": "Yaoundé", "region": "Centre",   "quantity": 12 }
      ],
      "updatedAt": "2026-08-01T09:12:00.000Z"
    }
  ],
  "meta": {
    "total": 128,
    "page": 1,
    "limit": 20,
    "pages": 7,
    "summary": {
      "skuCount": 128,
      "unitCount": 4310,
      "lowStockCount": 9,
      "outOfStockCount": 2,
      "vendorCount": 11
    }
  }
}
```

### Field notes

| Field | Notes |
|---|---|
| `id` | Stable identity of the line; what `GET /:id` takes. A composite (`agencyId:variantId`) is fine — the client treats it as opaque. |
| `title` / `sku` / `variantTitle` | **Nullable.** Read live from the catalogue; null when the product or variant can no longer be resolved. The client renders "Unnamed product" and keeps the row — a line we physically hold must not vanish because its catalogue entry did. |
| `image` | The standard file object (`{ id, key, url, mimeType, size, originalName }`) or `null` — never a bare URL string. Variant's own picture, else the product's first. |
| `onHand` | Physical units across every location. Sum of `locations[].quantity`. |
| `reserved` | Units locked by in-flight orders. `0` until reservations are wired (§0) — send `0`, not `null`. |
| `available` | `onHand − reserved`. Sent, not computed client-side, so the list, badge and filter can never disagree. |
| `lowStockThreshold` | The **vendor's** `low_stock_threshold` for the variant, or `null`. (Note the existing snake/camel split: schema field is `low_stock_threshold`, the vendor API sends `lowStockThreshold`. Please send camel here.) |
| `stockState` | Derived server-side: `available <= 0` → `out_of_stock`; else `threshold !== null && available <= threshold` → `low`; else `in_stock`. A line with no threshold is never `low` — same rule as `GET /api/vendor/inventory/alerts`. |
| `locations[]` | Only locations holding **≥1 unit**. `label`/`city`/`region` are **denormalised onto the payload**, not looked up client-side: magazin labels are nullable and editable, and a count that outlives a renamed or deleted HQ entry still has to print something truthful. |
| `meta.summary` | Totals for the **whole filtered set**, not the page — the summary strip has to keep counting past page 1. |

---

## 3. `GET /api/agency/inventory/:id`

Everything the list row has, plus the per-location breakdown and the movement
trail. Powers the detail sheet.

### Success `200`

```json
{
  "success": true,
  "data": {
    "id": "66a1f0c2e4b0a1d2c3e4f501",
    "productId": "507f1f77bcf86cd799439066",
    "variantId": "507f1f77bcf86cd799439060",
    "title": "Blue T-Shirt",
    "variantTitle": "Black / M",
    "sku": "SHIRT-BLK-M",
    "image": { "id": "…", "key": "…", "url": "…", "mimeType": "image/jpeg", "size": 88110, "originalName": "tshirt-front.jpg" },
    "images": [
      { "id": "…", "key": "…", "url": "…", "mimeType": "image/jpeg", "size": 88110, "originalName": "tshirt-front.jpg" }
    ],
    "vendor": { "id": "…", "businessName": "Acme Store", "phone": "+237670000001", "email": "acme@example.com" },
    "onHand": 42,
    "reserved": 3,
    "available": 39,
    "lowStockThreshold": 5,
    "stockState": "in_stock",
    "category": "apparel",
    "weightGrams": 220,
    "barcode": "5901234123457",
    "productStatus": "active",
    "storedSince": "2026-03-14T08:00:00.000Z",
    "openShipmentCount": 2,
    "updatedAt": "2026-08-01T09:12:00.000Z",
    "locations": [
      {
        "locationId": "6641abc123def457",
        "label": "Douala HQ",
        "city": "Douala",
        "region": "Littoral",
        "quantity": 30,
        "lastMovementAt": "2026-08-01T09:12:00.000Z",
        "address": {
          "label": "Douala HQ",
          "formattedAddress": "Akwa, Douala, Cameroon",
          "addressLine1": "Akwa, Rue Sylvani, immeuble ABC",
          "addressLine2": null,
          "city": "Douala",
          "state": "Littoral",
          "country": "Cameroon",
          "coordinates": { "lat": 4.0511, "lng": 9.7043 }
        }
      }
    ],
    "movements": [
      {
        "id": "66a1f0c2e4b0a1d2c3e4f777",
        "delta": -2,
        "previousQuantity": 32,
        "newQuantity": 30,
        "operation": "order",
        "locationId": "6641abc123def457",
        "occurredAt": "2026-08-01T09:12:00.000Z",
        "metadata": { "orderId": "507f1f77bcf86cd799439001", "shipmentId": "507f1f77bcf86cd799439aa1" }
      }
    ]
  }
}
```

### Field notes

| Field | Notes |
|---|---|
| `images[]` | Every picture, thumbnail first. `image` is `images[0]` — same convention as `shipments.md` `items[].images`. |
| `weightGrams` | Grams, from `ProductVariant.weight`. Nullable — the vendor may never have set one; we still have to store the thing. |
| `barcode` | Nullable. Purely a picking aid; drop it from v1 if there is no field for it. |
| `productStatus` | The vendor-side catalogue status (`active` \| `draft` \| `archived`). The sheet flags `archived` explicitly: a line we still hold whose product is archived is **dead stock** — never orderable again, still occupying a shelf, still accruing the per-SKU fee. |
| `openShipmentCount` | Undelivered shipments already drawing on this line. The real, human-readable claim behind `reserved`. |
| `locations[].address` | The **standard `AddressDetail` shape** already used by `shipments.md` (`label`, `formattedAddress`, `addressLine1/2`, `city`, `state`, `country`, `coordinates`) — not the raw magazin HQ entry, so one client-side formatter serves both screens. Nullable. |
| `movements[]` | Newest first, **capped server-side** (20 is plenty). |
| `movements[].operation` | `intake` \| `order` \| `reservation` \| `release` \| `transfer` \| `adjustment` \| `return`. A superset of the vendor audit log's values: the four that can happen to warehoused goods, plus the three that only exist once stock has a location. Unknown values render as the raw key, so adding one is not breaking. |
| `movements[].locationId` | Nullable — a movement the ledger cannot place. |

### Errors

| Status | Code | Reason |
|---|---|---|
| `401` | `UNAUTHORIZED` | Missing or invalid token |
| `403` | `FORBIDDEN` | Caller is not an agency |
| `404` | `INVENTORY_LINE_NOT_FOUND` | No such line, or it belongs to another agency (do not distinguish the two) |
| `500` | `INTERNAL_ERROR` | Unexpected server error |

---

## 4. Ordered asks

Sized so each step ships something useful on its own.

### Phase 1 — make the screen real (unblocks everything below)

1. `agency_stock_levels` (§1) + a way for rows to be created. Simplest honest
   v1: a row appears the first time an `agency_storage` product of a connected
   vendor is seen, seeded at `quantity: 0` and placed at
   `headquarters_addresses[0]`.
2. `GET /api/agency/inventory` (§2) and `GET /api/agency/inventory/:id` (§3).
3. Denormalise `label`/`city`/`region` onto each location row at read time from
   the magazin.

With only this, the screen is fully functional except that `reserved` is always
`0` and quantities only move when someone sets them.

### Phase 2 — make the numbers true

4. Add `variant_id` (and ideally `sku`) to `Shipment.items[]`. Blocker for
   everything else here; the value is already on the order item.
5. Decrement `agency_stock_levels` when a storage-based shipment is delivered,
   and write a movement row (`operation: "order"`, with `shipmentId`).
6. Restore on `returned` / `failed` (`operation: "return"`).
7. Wire the existing `StockReservationService` / `StockCommitService` /
   `StockReleaseService` so `reserved` and `available` stop being placeholders.

### Phase 3 — multi-location, properly

8. Replace the `headquarters_addresses[0]` hardcodes (`magazin.repository.ts:127`,
   `shipment.service.ts:818`, `handover-pickup.service.ts:163`,
   `assignment-candidate.service.ts:391`, `delivery-agency.repository.ts:298`)
   with the location that actually holds the stock. Until this lands, a second
   warehouse can be *displayed* but shipments will still be routed to the first.
9. An intake flow (goods physically arrive → `operation: "intake"`) and a
   transfer between our own locations (`operation: "transfer"`).

### Phase 4 — bill for it

10. The recurring `monthly_storage_fee_per_sku` job the earnings service already
    has a TODO for. `COUNT(DISTINCT variant_id) WHERE agency_id = …` is now a
    query that can be written.

---

## 5. Explicitly out of scope

The dashboard screen is **read-only** and there is no ask for write endpoints
here. Stock is vendor-owned truth; an agency correcting a count is a real
workflow but it needs a dispute/approval story (who wins when the agency counts
40 and the vendor's catalogue says 42?) that should be designed on its own rather
than bolted onto a listing screen.

Also not asked for: batch/lot tracking, expiry dates, serial numbers, bin-level
placement within a warehouse, or capacity limits per location. None of them exist
today and none are needed for this screen.
