# Frontend changelog — private files leave the public URL

**Date:** 2026-08-19 · **Breaking** · jovi-mall
**Design record:** `docs/ADR-A01-UPLOAD-DOWNLOAD-MAP.md` (`backend/jovi-mall/docs/ADR-A01-UPLOAD-DOWNLOAD-MAP.md` — not mirrored in this repository) D-2

> ⚠ **Read this before your next release if you render a delivery-proof photo.** One field on
> one shared shape changes, and the change is deliberately a *type* change so your compiler
> points at every place that needs looking at.

> 🆕 **UPDATE 2026-09-07 — `access` gained a THIRD value, `"quota_blocked"`.** This changelog
> was written when there were two. Everything below is still accurate about the private-tree
> case; what it does **not** cover is a file whose owner has run out of storage allowance.
> Jump to [§ The third value](#the-third-value-quota_blocked) — it affects **every** surface
> that renders a file, public trees included, not just delivery proof.

**Verified against source on 2026-09-08** — the `FileDetail` shape, all three `access` values and
their precedence, against `jovi-mall/src/modules/catalog/read-models/file-detail.resolver.ts`,
`.../product-detail.read-model.ts` and `src/core/storage/storage-trees.ts`.

---

## What changed, in one paragraph

Three storage trees — **`digital/`**, **`shipments/`** and **`ticket-attachments/`** — are no
longer served by the static file mount. Their files come from an authorized route instead.
Every `FileDetail` for a file in one of those trees now returns **`url: null`** and a new
field **`access: "authorized"`**.

Everything else — product imagery, avatars, store logos and banners, videos, documents
uploaded through the general intake — is **unchanged**. Same URLs, same behaviour.

## Why

The static mount served the whole of `storage/`, and a stored file's `url` *was* that path. So
anyone who had ever seen the URL could fetch the file, forever, with no session:

- a **digital product** a customer bought could be re-shared by URL indefinitely, bypassing the
  download token's single-use consumption, its download counter and its revocation — all three
  were advisory while the raw path existed, and nothing recorded that it happened;
- a **delivery-proof photo** is a place and a time about a real customer's address.

## The wire change

`FileDetail` is the shape every referenced file comes back as — product media, avatars, logos,
banners, proof photos, ticket attachments. It gains one field and one of its fields becomes
nullable:

```diff
  {
    "id": "66b1…",
    "key": "shipments/2026/08/9f2c…_proof.jpg",
-   "url": "https://api.example.com/api/files/shipments/2026/08/9f2c…_proof.jpg",
+   "url": null,
+   "access": "authorized",
    "mimeType": "image/jpeg",
    "size": 284119,
    "originalName": "proof.jpg"
  }
```

```jsonc
// a public file — unchanged except for the new field
{ "id": "…", "key": "images/…", "url": "https://…/api/files/images/…",
  "access": "public", "mimeType": "image/png", "size": 10241 }
```

| Field | Type | Meaning |
|---|---|---|
| `url` | `string \| null` | fetchable directly when a string. **`null` means there is no public URL** — use the authorized route below. |
| `access` | `"public" \| "authorized" \| "quota_blocked"` | which kind of file this is. **Always present.** Anything but `"public"` means `url` is `null`. |

**`url` is `null` rather than the authorized path on purpose.** An authorized path is a string
that looks exactly like a public URL, so a client keeps `<img src={url}>` and silently renders
nothing for anyone who is not signed in — a bug that shows up as "the photo is sometimes
missing" and takes a week to find. `null` breaks the build instead.

## What to do

**1. Anything rendering a file from `FileDetail.url` should branch on `access`.**

```ts
// TypeScript will now flag `url` as possibly null — that flag IS the migration list.
if (file.access === 'public' && file.url) {
  return <img src={file.url} />;
}
// authorized: fetch through the owning entity's route (below), with credentials.
```

**2. Delivery-proof photos: use the new route.**

| Role | Route |
|---|---|
| agent | `GET /api/agent/shipments/:shipmentId/delivery-proof/file` |
| agency | `GET /api/agency/shipments/:shipmentId/delivery-proof/file` |

Both return the image bytes (`Content-Type` from the file, `Content-Disposition: inline`,
`Cache-Control: private, no-store`). Authorization is the **shipment's own** — the same scoping
as `GET /api/{agent,agency}/shipments/:id`, so if you can read the shipment you can read its
proof. A shipment that is not yours, or that has no proof, is **404** — never 403.

The metadata route is unchanged and still useful for `originalName` / `size` / "is there one":
`GET /api/agent/shipments/:id/delivery-proof`.

Because these are same-origin cookie-authenticated GETs, a browser `<img src="/api/agency/…">`
works directly. A bearer client (Capacitor / native) must fetch with its `Authorization` header
and turn the response into a blob URL.

**3. Digital products: nothing to do.** `GET /api/digital/download/:token` was already the
documented path and is unchanged. What changed is that it is now the *only* path — which is
what makes its single-use consumption, its counter and its revocation actually mean something.

**4. Ticket attachments: nothing to do today, and this is worth knowing.** The
`storage/ticket-attachments/` tree is legacy and holds one pre-existing file; a ticket
attachment today is an ordinary general-intake upload that lands in `images/` or `documents/`
and stays **public**. Making those private needs a dedicated upload path and is not in this
release — do not read this changelog as having closed that gap.

## The third value: `quota_blocked`

Added **2026-09-07**, after this changelog was first written. `access` is now:

| `access` | `url` | What it means, and what to render |
|---|---|---|
| `"public"` | a real URL | ordinary media — render it |
| `"authorized"` | **`null`** | the file is in a private tree; fetch the bytes from the owning entity's route, keyed on `id` (everything above) |
| `"quota_blocked"` | **`null`** | **the owner is over their storage plan.** Not deleted, not private, not their fault. |

**`quota_blocked` is a billing state, and the right screen is not an error screen.** The file
still exists, the bytes are untouched, and it still counts toward the owner's used storage —
blocking is what an owner gets *instead* of losing data when a plan downgrade puts them over the
cap. It comes back **unchanged** the moment they upgrade or free room.

So: render a **placeholder and an upgrade prompt**. Never a broken image. Never "file missing" or
"file deleted" — both are wrong, and "deleted" starts a support conversation about data loss that
did not happen.

⚠ **`quota_blocked` outranks `authorized`.** A blocked file that also sits in a private tree
reports `quota_blocked`, not `authorized`. If you branch on `authorized` first you will send the
client to the owning entity's byte route, and the answer it gets back will describe a permissions
problem when the real one is billing.

```ts
// Order matters: check the blocked case before the private one.
switch (file.access) {
  case 'public':        return <img src={file.url!} alt={file.originalName ?? ''} />;
  case 'quota_blocked': return <StoragePlaceholder onUpgrade={goToPlanPage} />;
  case 'authorized':    return <AuthorizedImage id={file.id} />;
}
```

**This applies to public trees too.** Product photos, avatars and logos all live in public trees
and can all come back `quota_blocked` — the tree classification and the quota check are
independent. A page that only handles `quota_blocked` on the private surfaces will still show
broken images on the ordinary ones.

## What did NOT change

- Every public URL. Product imagery, avatars, logos, banners, videos and general documents keep
  the exact URLs they had.
- Any upload endpoint, request shape or response envelope.
- The 73 files already on disk — **this is a routing change, not a migration.** Nothing moved.
- Ticket attachment behaviour (see above).

## Please check before we ship

Per ADR-A01, the two surfaces most likely to be rendering a raw proof-photo URL are the
**agency dashboard** and the **agent app**. If either builds an `<img>` from
`shipment.deliveryProof.url`, it will render nothing after this release until it moves to the
route above. The backend cannot verify this from its own repository — hence this document.
