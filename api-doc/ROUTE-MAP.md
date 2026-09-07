# ROUTE MAP — every backend route this dashboard can call

**Verified against source on 2026-09-08** — the route census, the per-tree counts and the five routes added since 2026-08-24, against the live route table.

**Generated 2026-08-24 (PLAN-3) from a live router dump, not from documentation.**

This file exists to make one claim measurable: **every route is documented in exactly one
place, and every route is documented.** It is the index an audit greps, and the reason it
spells every path in full — several pages document their routes relative to a base path
(`POST /:id/receipts`), which reads well and cannot be found by searching for the real path.

## How to regenerate

```bash
cd backend/jovi-mall && node -r ts-node/register/transpile-only -r dotenv/config \
    ../FRONTEND-SYNC/tools/dump-routes.js "$(pwd)/src/app.ts" | grep " /api/agency" | wc -l
```

⚠ The dumper prints ten boot-log lines, a blank line and its own `TOTAL` footer, so `wc -l` on
the whole dump over-counts by 12. `grep -cE "^(GET|POST|PUT|PATCH|DELETE) /"` is the honest
count, and it agrees with the tool's own footer.

**Re-measured 2026-09-08: the workspace-wide figure is 764 routes** (`wc -l` reads 776). It was
665 when this page was written and 677 in an edition before that — **do not quote it from
memory.** The **132** agency figure below is unaffected and was re-verified on the same day; it
comes from a filtered grep and has not moved.

---

## 1 · jovi-mall — the 132 `/api/agency/*` routes

Verified 2026-08-24: **132 routes, 20 documents, 0 undocumented, 0 duplicated.**

### Agent roster & contracts — 30 routes

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/agents/` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `GET` | `/api/agency/agents/:agentId/eligibility` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `GET` | `/api/agency/agents/:agentId/history` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `DELETE` | `/api/agency/agents/:membershipId` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `GET` | `/api/agency/agents/:membershipId` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `POST` | `/api/agency/agents/:membershipId/approve` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `PATCH` | `/api/agency/agents/:membershipId/cod-limit` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `POST` | `/api/agency/agents/:membershipId/counter` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `PATCH` | `/api/agency/agents/:membershipId/employment` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `POST` | `/api/agency/agents/:membershipId/pause` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `POST` | `/api/agency/agents/:membershipId/reinstate` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `POST` | `/api/agency/agents/:membershipId/reject` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `GET` | `/api/agency/agents/:membershipId/settlements` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `POST` | `/api/agency/agents/:membershipId/suspend` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `POST` | `/api/agency/agents/:membershipId/terminate` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `PATCH` | `/api/agency/agents/:membershipId/terms` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `GET` | `/api/agency/agents/:membershipId/terms-proposals` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `POST` | `/api/agency/agents/:membershipId/terms-proposals` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `POST` | `/api/agency/agents/:membershipId/withdraw` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `GET` | `/api/agency/agents/browse` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `GET` | `/api/agency/agents/eligible` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `GET` | `/api/agency/agents/history` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `POST` | `/api/agency/agents/requests` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `GET` | `/api/agency/agents/status-requests` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `POST` | `/api/agency/agents/status-requests/:requestId/cancel` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `POST` | `/api/agency/agents/status-requests/:requestId/resolve` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `GET` | `/api/agency/agents/terms-proposals` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `POST` | `/api/agency/agents/terms-proposals/:proposalId/cancel` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `POST` | `/api/agency/agents/terms-proposals/:proposalId/counter` | [agency/agent-roster.md](./agency/agent-roster.md) |
| `POST` | `/api/agency/agents/terms-proposals/:proposalId/resolve` | [agency/agent-roster.md](./agency/agent-roster.md) |

### Assignment — 5 routes

| Method | Path | Document |
|---|---|---|
| `PATCH` | `/api/agency/assignment-settings` | [agency/assignment.md](./agency/assignment.md) |
| `PATCH` | `/api/agency/shipments/:id/assign-agent` | [agency/assignment.md](./agency/assignment.md) |
| `GET` | `/api/agency/shipments/:id/assignment-candidates` | [agency/assignment.md](./agency/assignment.md) |
| `POST` | `/api/agency/shipments/:id/auto-assign` | [agency/assignment.md](./agency/assignment.md) |
| `POST` | `/api/agency/shipments/:id/offer/cancel` | [agency/assignment.md](./agency/assignment.md) |

### COD cash — 9 routes

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/cod/deposits` | [agency/cod-cash-management.md](./agency/cod-cash-management.md) |
| `POST` | `/api/agency/cod/deposits` | [agency/cod-cash-management.md](./agency/cod-cash-management.md) |
| `POST` | `/api/agency/cod/deposits/:id/confirm` | [agency/cod-cash-management.md](./agency/cod-cash-management.md) |
| `POST` | `/api/agency/cod/deposits/:id/reject` | [agency/cod-cash-management.md](./agency/cod-cash-management.md) |
| `GET` | `/api/agency/cod/discrepancies` | [agency/cod-cash-management.md](./agency/cod-cash-management.md) |
| `POST` | `/api/agency/cod/discrepancies` | [agency/cod-cash-management.md](./agency/cod-cash-management.md) |
| `GET` | `/api/agency/cod/remittances` | [agency/cod-cash-management.md](./agency/cod-cash-management.md) |
| `POST` | `/api/agency/cod/remittances` | [agency/cod-cash-management.md](./agency/cod-cash-management.md) |
| `GET` | `/api/agency/cod/summary` | [agency/cod-cash-management.md](./agency/cod-cash-management.md) |

### Billing — credit wallet — 4 routes

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/credits` | [agency/billing.md](./agency/billing.md) |
| `GET` | `/api/agency/credits/packs` | [agency/billing.md](./agency/billing.md) |
| `POST` | `/api/agency/credits/topups` | [agency/billing.md](./agency/billing.md) |
| `POST` | `/api/agency/credits/topups/:id/verify` | [agency/billing.md](./agency/billing.md) |

### Push devices — 2 routes

| Method | Path | Document |
|---|---|---|
| `DELETE` | `/api/agency/devices` | [agency/notifications.md](./agency/notifications.md) |
| `POST` | `/api/agency/devices` | [agency/notifications.md](./agency/notifications.md) |

### Earnings & payout — 3 routes

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/earnings` | [agency/earnings.md](./agency/earnings.md) |
| `GET` | `/api/agency/earnings/payout` | [agency/earnings.md](./agency/earnings.md) |
| `POST` | `/api/agency/earnings/payout` | [agency/earnings.md](./agency/earnings.md) |

### Inventory (physical shelf) — 11 routes

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/inventory/` | [agency/inventory.md](./agency/inventory.md) |
| `GET` | `/api/agency/inventory/:id` | [agency/inventory.md](./agency/inventory.md) |
| `POST` | `/api/agency/inventory/:id/count` | [agency/inventory.md](./agency/inventory.md) |
| `GET` | `/api/agency/inventory/:id/movements` | [agency/inventory.md](./agency/inventory.md) |
| `POST` | `/api/agency/inventory/:id/receipts` | [agency/inventory.md](./agency/inventory.md) |
| `POST` | `/api/agency/inventory/:id/returns` | [agency/inventory.md](./agency/inventory.md) |
| `POST` | `/api/agency/inventory/:id/transfers` | [agency/inventory.md](./agency/inventory.md) |
| `PATCH` | `/api/agency/inventory/products/:productId/depot` | [agency/inventory.md](./agency/inventory.md) |
| `POST` | `/api/agency/inventory/products/:productId/suspend` | [agency/inventory.md](./agency/inventory.md) |
| `POST` | `/api/agency/inventory/products/:productId/unsuspend` | [agency/inventory.md](./agency/inventory.md) |
| `GET` | `/api/agency/inventory/summary` | [agency/inventory.md](./agency/inventory.md) |

### Magazin (depots) — 2 routes

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/magazin/` | [agency/magazin.md](./agency/magazin.md) |
| `PATCH` | `/api/agency/magazin/` | [agency/magazin.md](./agency/magazin.md) |

### Notification preferences — 2 routes

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/notification-preferences` | [agency/notifications.md](./agency/notifications.md) |
| `PATCH` | `/api/agency/notification-preferences` | [agency/notifications.md](./agency/notifications.md) |

### Notifications — 3 routes

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/notifications` | [agency/notifications.md](./agency/notifications.md) |
| `PATCH` | `/api/agency/notifications/:id/read` | [agency/notifications.md](./agency/notifications.md) |
| `POST` | `/api/agency/notifications/read-all` | [agency/notifications.md](./agency/notifications.md) |

### Onboarding — 5 routes

| Method | Path | Document |
|---|---|---|
| `PUT` | `/api/agency/onboarding/branding` | [agency/onboarding.md](./agency/onboarding.md) |
| `PUT` | `/api/agency/onboarding/logistics` | [agency/onboarding.md](./agency/onboarding.md) |
| `PUT` | `/api/agency/onboarding/payout` | [agency/onboarding.md](./agency/onboarding.md) |
| `PUT` | `/api/agency/onboarding/policies` | [agency/onboarding.md](./agency/onboarding.md) |
| `GET` | `/api/agency/onboarding/status` | [agency/onboarding.md](./agency/onboarding.md) |

### Billing — plan purchase — 1 route

| Method | Path | Document |
|---|---|---|
| `POST` | `/api/agency/plan-purchases/:id/verify` | [agency/billing.md](./agency/billing.md) |

### Billing — plans — 2 routes

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/plans` | [agency/billing.md](./agency/billing.md) |
| `POST` | `/api/agency/plans/:planId/purchase` | [agency/billing.md](./agency/billing.md) |

### Billing — current plan — 1 route

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/plan` | [agency/billing.md](./agency/billing.md) |

### Deliverable products (legacy) — 1 route

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/products` | [agency/products.md](./agency/products.md) |

### Profile — 4 routes

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/profile` | [agency/profile.md](./agency/profile.md) |
| `PATCH` | `/api/agency/profile` | [agency/profile.md](./agency/profile.md) |
| `GET` | `/api/agency/profile/completion-status` | [agency/profile.md](./agency/profile.md) |
| `POST` | `/api/agency/profile/policy-documents` | [agency/profile.md](./agency/profile.md) |

### Reviews (cross-role) — 3 routes

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/reviews/` | [reviews.md](./reviews.md) |
| `POST` | `/api/agency/reviews/` | [reviews.md](./reviews.md) |
| `GET` | `/api/agency/reviews/eligibility` | [reviews.md](./reviews.md) |

### Settings — 2 routes

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/settings` | [agency/billing.md](./agency/billing.md) |
| `PATCH` | `/api/agency/settings` | [agency/billing.md](./agency/billing.md) |

### Assignment — reassign — 1 route

| Method | Path | Document |
|---|---|---|
| `POST` | `/api/agency/shipments/:id/reassign` | [agency/assignment.md](./agency/assignment.md) |

### Delivery proof (private file) — 1 route

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/shipments/:id/delivery-proof/file` | [files/private-files.md](./files/private-files.md) |

### Shipments — 4 routes

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/shipments` | [agency/shipments.md](./agency/shipments.md) |
| `GET` | `/api/agency/shipments/:id` | [agency/shipments.md](./agency/shipments.md) |
| `POST` | `/api/agency/shipments/:id/reject` | [agency/shipments.md](./agency/shipments.md) |
| `PATCH` | `/api/agency/shipments/:id/status` | [agency/shipments.md](./agency/shipments.md) |

### Stock requests — 6 routes

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/stock-requests/` | [agency/stock-requests.md](./agency/stock-requests.md) |
| `POST` | `/api/agency/stock-requests/` | [agency/stock-requests.md](./agency/stock-requests.md) |
| `GET` | `/api/agency/stock-requests/:id` | [agency/stock-requests.md](./agency/stock-requests.md) |
| `POST` | `/api/agency/stock-requests/:id/approve` | [agency/stock-requests.md](./agency/stock-requests.md) |
| `POST` | `/api/agency/stock-requests/:id/reject` | [agency/stock-requests.md](./agency/stock-requests.md) |
| `POST` | `/api/agency/stock-requests/:id/withdraw` | [agency/stock-requests.md](./agency/stock-requests.md) |

### Storage statements — 4 routes

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/storage-invoices/` | [agency/storage-invoices.md](./agency/storage-invoices.md) |
| `GET` | `/api/agency/storage-invoices/:id` | [agency/storage-invoices.md](./agency/storage-invoices.md) |
| `POST` | `/api/agency/storage-invoices/:id/settle` | [agency/storage-invoices.md](./agency/storage-invoices.md) |
| `POST` | `/api/agency/storage-invoices/:id/void` | [agency/storage-invoices.md](./agency/storage-invoices.md) |

### Support tickets — 14 routes

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/tickets/` | [agency/tickets.md](./agency/tickets.md) |
| `POST` | `/api/agency/tickets/` | [agency/tickets.md](./agency/tickets.md) |
| `GET` | `/api/agency/tickets/:id` | [agency/tickets.md](./agency/tickets.md) |
| `PATCH` | `/api/agency/tickets/:id` | [agency/tickets.md](./agency/tickets.md) |
| `PATCH` | `/api/agency/tickets/:id/assign` | [agency/tickets.md](./agency/tickets.md) |
| `POST` | `/api/agency/tickets/:id/close` | [agency/tickets.md](./agency/tickets.md) |
| `PATCH` | `/api/agency/tickets/:id/priority` | [agency/tickets.md](./agency/tickets.md) |
| `PATCH` | `/api/agency/tickets/:id/status` | [agency/tickets.md](./agency/tickets.md) |
| `GET` | `/api/agency/tickets/:ticketId/attachments` | [agency/tickets.md](./agency/tickets.md) |
| `POST` | `/api/agency/tickets/:ticketId/attachments` | [agency/tickets.md](./agency/tickets.md) |
| `GET` | `/api/agency/tickets/:ticketId/notes` | [agency/tickets.md](./agency/tickets.md) |
| `POST` | `/api/agency/tickets/:ticketId/notes` | [agency/tickets.md](./agency/tickets.md) |
| `GET` | `/api/agency/tickets/reference/orders` | [agency/tickets.md](./agency/tickets.md) |
| `GET` | `/api/agency/tickets/reference/products` | [agency/tickets.md](./agency/tickets.md) |

### Live-tracking board — 1 route

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/tracking/board` | [agency/live-tracking.md](./agency/live-tracking.md) |

### Transactions — 1 route

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/transactions/` | [agency/billing.md](./agency/billing.md) |

### Vendor connections — 8 routes

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/vendor-connections/` | [agency/vendor-connections.md](./agency/vendor-connections.md) |
| `POST` | `/api/agency/vendor-connections/` | [agency/vendor-connections.md](./agency/vendor-connections.md) |
| `GET` | `/api/agency/vendor-connections/:id` | [agency/vendor-connections.md](./agency/vendor-connections.md) |
| `POST` | `/api/agency/vendor-connections/:id/approve` | [agency/vendor-connections.md](./agency/vendor-connections.md) |
| `POST` | `/api/agency/vendor-connections/:id/reject` | [agency/vendor-connections.md](./agency/vendor-connections.md) |
| `POST` | `/api/agency/vendor-connections/:id/terminate` | [agency/vendor-connections.md](./agency/vendor-connections.md) |
| `POST` | `/api/agency/vendor-connections/:id/withdraw` | [agency/vendor-connections.md](./agency/vendor-connections.md) |
| `GET` | `/api/agency/vendor-connections/browse` | [agency/vendor-connections.md](./agency/vendor-connections.md) |

### Connected vendors (legacy) — 1 route

| Method | Path | Document |
|---|---|---|
| `GET` | `/api/agency/vendors` | [agency/vendors.md](./agency/vendors.md) |

### Agency creation — 1 route

| Method | Path | Document |
|---|---|---|
| `POST` | `/api/agency/` | [agency/onboarding.md](./agency/onboarding.md) |

### Reconciliation by document

| Document | Routes |
|---|---:|
| [agency/agent-roster.md](./agency/agent-roster.md) | 30 |
| [agency/tickets.md](./agency/tickets.md) | 14 |
| [agency/billing.md](./agency/billing.md) | 11 |
| [agency/inventory.md](./agency/inventory.md) | 11 |
| [agency/cod-cash-management.md](./agency/cod-cash-management.md) | 9 |
| [agency/vendor-connections.md](./agency/vendor-connections.md) | 8 |
| [agency/notifications.md](./agency/notifications.md) | 7 |
| [agency/onboarding.md](./agency/onboarding.md) | 6 |
| [agency/assignment.md](./agency/assignment.md) | 6 |
| [agency/stock-requests.md](./agency/stock-requests.md) | 6 |
| [agency/profile.md](./agency/profile.md) | 4 |
| [agency/shipments.md](./agency/shipments.md) | 4 |
| [agency/storage-invoices.md](./agency/storage-invoices.md) | 4 |
| [agency/earnings.md](./agency/earnings.md) | 3 |
| [reviews.md](./reviews.md) | 3 |
| [agency/magazin.md](./agency/magazin.md) | 2 |
| [agency/products.md](./agency/products.md) | 1 |
| [files/private-files.md](./files/private-files.md) | 1 |
| [agency/live-tracking.md](./agency/live-tracking.md) | 1 |
| [agency/vendors.md](./agency/vendors.md) | 1 |
| **Total** | **132** |

---

## 2 · jovi-mall — the shared, role-agnostic surface

These are not under `/api/agency`, carry no `requireRole(['agency'])`, and are reachable with
the same session. **✅ marks the ones `agency-dash/src/` calls today** (from the manual sweep
of all 402 path literals — see [MIGRATION-2026-08.md](./MIGRATION-2026-08.md) § 1).

### Session auth (shared)

| | Method | Path | Document |
|---|---|---|---|
| ✅ | `POST` | `/api/auth/add-role` | [auth/README.md](./auth/README.md) |
| ✅ | `GET` | `/api/auth/auth-me/:role` | [auth/README.md](./auth/README.md) |
|   | `POST` | `/api/auth/email-change/confirm` | [auth/README.md](./auth/README.md) |
| ✅ | `POST` | `/api/auth/forgot-password` | [auth/README.md](./auth/README.md) |
| ✅ | `POST` | `/api/auth/login` | [auth/README.md](./auth/README.md) |
| ✅ | `POST` | `/api/auth/logout` | [auth/README.md](./auth/README.md) |
| ✅ | `GET` | `/api/auth/me` | [auth/README.md](./auth/README.md) |
| ✅ | `POST` | `/api/auth/register` | [auth/README.md](./auth/README.md) |
| ✅ | `POST` | `/api/auth/reset-password` | [auth/README.md](./auth/README.md) |
| ✅ | `POST` | `/api/auth/send-email-verification` | [auth/README.md](./auth/README.md) |
|   | `GET` | `/api/auth/verify-email` | [auth/README.md](./auth/README.md) |

### Session auth (browser, cookie)

| | Method | Path | Document |
|---|---|---|---|
|   | `POST` | `/api/auth/browser/login` | [auth/README.md](./auth/README.md) |
|   | `POST` | `/api/auth/browser/logout` | [auth/README.md](./auth/README.md) |
| ✅ | `POST` | `/api/auth/browser/refresh` | [auth/README.md](./auth/README.md) |

### Bot sign-in / password reset

| | Method | Path | Document |
|---|---|---|---|
|   | `POST` | `/api/auth/magic/code` | [auth/magic-login.md](./auth/magic-login.md) |
|   | `POST` | `/api/auth/magic/link` | [auth/magic-login.md](./auth/magic-login.md) |

### Session auth (bearer, Capacitor)

| | Method | Path | Document |
|---|---|---|---|
| ✅ | `POST` | `/api/auth/mobile/add-role` | [auth/FRONTEND-CHANGELOG-mobile-auth.md](./auth/FRONTEND-CHANGELOG-mobile-auth.md) |
| ✅ | `GET` | `/api/auth/mobile/auth-me/:role` | [auth/FRONTEND-CHANGELOG-mobile-auth.md](./auth/FRONTEND-CHANGELOG-mobile-auth.md) |
| ✅ | `POST` | `/api/auth/mobile/login` | [auth/FRONTEND-CHANGELOG-mobile-auth.md](./auth/FRONTEND-CHANGELOG-mobile-auth.md) |
|   | `POST` | `/api/auth/mobile/magic/code` | [auth/FRONTEND-CHANGELOG-mobile-auth.md](./auth/FRONTEND-CHANGELOG-mobile-auth.md) |
|   | `POST` | `/api/auth/mobile/magic/link` | [auth/FRONTEND-CHANGELOG-mobile-auth.md](./auth/FRONTEND-CHANGELOG-mobile-auth.md) |
| ✅ | `POST` | `/api/auth/mobile/refresh` | [auth/FRONTEND-CHANGELOG-mobile-auth.md](./auth/FRONTEND-CHANGELOG-mobile-auth.md) |
| ✅ | `POST` | `/api/auth/mobile/register` | [auth/FRONTEND-CHANGELOG-mobile-auth.md](./auth/FRONTEND-CHANGELOG-mobile-auth.md) |

### Uploads & file library

| | Method | Path | Document |
|---|---|---|---|
| ✅ | `GET` | `/api/files/` | [uploads/README.md](./uploads/README.md) |
| ✅ | `DELETE` | `/api/files/:id` | [uploads/README.md](./uploads/README.md) |
| ✅ | `GET` | `/api/files/:id` | [uploads/README.md](./uploads/README.md) |
| ✅ | `PATCH` | `/api/files/:id` | [uploads/README.md](./uploads/README.md) |
| ✅ | `GET` | `/api/files/storage` | [uploads/README.md](./uploads/README.md) |
| ✅ | `POST` | `/api/files/upload` | [uploads/README.md](./uploads/README.md) |
| ✅ | `POST` | `/api/files/upload/video` | [uploads/README.md](./uploads/README.md) |

### Address search & reverse geocode

| | Method | Path | Document |
|---|---|---|---|
| ✅ | `GET` | `/api/geo/reverse` | [geo/README.md](./geo/README.md) |
| ✅ | `GET` | `/api/geo/search` | [geo/README.md](./geo/README.md) |

### Health & readiness

| | Method | Path | Document |
|---|---|---|---|
|   | `GET` | `/api/health/` | [health.md](./health.md) |
|   | `GET` | `/api/health/live` | [health.md](./health.md) |
|   | `GET` | `/api/health/ready` | [health.md](./health.md) |

### Account closure (customer-only)

| | Method | Path | Document |
|---|---|---|---|
|   | `POST` | `/api/me/close` | [me/account-closure.md](./me/account-closure.md) |

### Messaging connections 🔴 replaces the dead calls

| | Method | Path | Document |
|---|---|---|---|
|   | `GET` | `/api/me/connections/` | [connections/README.md](./connections/README.md) |
|   | `POST` | `/api/me/connections/` | [connections/README.md](./connections/README.md) |
|   | `DELETE` | `/api/me/connections/:channel` | [connections/README.md](./connections/README.md) |

### Change sign-in email / phone

| | Method | Path | Document |
|---|---|---|---|
|   | `GET` | `/api/me/contact` | [me/contact-change.md](./me/contact-change.md) |
|   | `PATCH` | `/api/me/email` | [me/contact-change.md](./me/contact-change.md) |
|   | `DELETE` | `/api/me/email/pending` | [me/contact-change.md](./me/contact-change.md) |
|   | `PATCH` | `/api/me/phone` | [me/contact-change.md](./me/contact-change.md) |
|   | `POST` | `/api/me/phone/confirm` | [me/contact-change.md](./me/contact-change.md) |
|   | `DELETE` | `/api/me/phone/pending` | [me/contact-change.md](./me/contact-change.md) |

### Change password

| | Method | Path | Document |
|---|---|---|---|
| ✅ | `PATCH` | `/api/me/password` | [me/password.md](./me/password.md) |

### Saved payment methods

| | Method | Path | Document |
|---|---|---|---|
| ✅ | `GET` | `/api/me/payment-methods/` | [agency/payment-methods.md](./agency/payment-methods.md) |
| ✅ | `POST` | `/api/me/payment-methods/` | [agency/payment-methods.md](./agency/payment-methods.md) |
|   | `DELETE` | `/api/me/payment-methods/:id` | [agency/payment-methods.md](./agency/payment-methods.md) |
|   | `PATCH` | `/api/me/payment-methods/:id/default` | [agency/payment-methods.md](./agency/payment-methods.md) |
|   | `GET` | `/api/me/payment-methods/default` | [agency/payment-methods.md](./agency/payment-methods.md) |

### Payment initiate / verify

| | Method | Path | Document |
|---|---|---|---|
|   | `GET` | `/api/payments/:transactionId` | [payments/README.md](./payments/README.md) |
|   | `POST` | `/api/payments/:transactionId/authorize` | [payments/README.md](./payments/README.md) |
|   | `POST` | `/api/payments/initiate` | [payments/README.md](./payments/README.md) |
|   | `POST` | `/api/payments/verify` | [payments/README.md](./payments/README.md) |

### Tracking visibility policy

| | Method | Path | Document |
|---|---|---|---|
| ✅ | `GET` | `/api/tracking/visible-agents` | [tracking/live-tracking.md](./tracking/live-tracking.md) |

### Deliberately out of scope

Listed so a reader can tell "not documented" from "not ours". None of these is callable by
an agency dashboard.

| Surface | Why not |
|---|---|
| `/api/bookings/*` | vendor service bookings — no agency surface |
| `/api/digital/*` | digital-product downloads — customer/vendor only |
| `/api/products/:productId/*` | availability & slot booking — customer/vendor only |
| `/api/integrations/google/*` | a vendor's calendar integration |
| `/api/tracking/agent-state` | service-token receiver: **geo-tracker → jovi-mall**, never a client |
| `/api/webhooks/*` | inbound peer traffic (payment gateways, WhatsApp, Telegram). Signature-authenticated; not callable with a session |
| `/api/internal/*` | service-token surface, jovi-mall ↔ geo-tracker and ↔ wi-admin |
| `/api/vendor/* · /api/agent/* · /api/customer/* · /api/admin/*` | other roles. `/api/admin/*` no longer exists at all — it is `/api/internal/admin/*` |
| `/api/public/*` | the unauthenticated storefront and marketing surface |
| `/metrics` | Prometheus scrape |

---

## 3 · geo-tracker — all 22 routes

Read from source on 2026-08-24; this service has no route dumper. Registration sites:
`internal/modules/{health,location,routing,session,webhook,actionaudit,serviceaccess}/delivery/http/routes.go`,
`internal/modules/tracking/module.go:78` (the socket) and `cmd/server/main.go:114` (`/metrics`).
The `authz`, `eta` and `geofence` modules register **no** routes — their `RegisterRoutes` is a
documented no-op.

⚠ **No `/api` prefix.** geo-tracker mounts at the root, on its own origin
(`VITE_GEO_TRACKER_URL`, default `http://localhost:8090`).

### The 16 an agency dashboard can call — viewer path

| Method | Path | Auth | Document | For this dashboard |
|---|---|---|---|---|
| `GET` | `/ws/track` | viewer JWT (cookie · subprotocol · bearer) | [geo-tracker/tracking-websocket.md](./geo-tracker/tracking-websocket.md) | ✅ **the live map** |
| `GET` | `/locations/{agentID}` | viewer JWT | [geo-tracker/locations.md](./geo-tracker/locations.md) | available — last-known position over HTTP |
| `GET` | `/tracking/sessions` | viewer JWT | [geo-tracker/tracking-sessions.md](./geo-tracker/tracking-sessions.md) | available |
| `GET` | `/tracking/sessions/{agentID}` | viewer JWT | [geo-tracker/tracking-sessions.md](./geo-tracker/tracking-sessions.md) | available — **the only way to tell a frozen marker's cause** |
| `GET` | `/tracking/sessions/{agentID}/eligibility` | viewer JWT | [geo-tracker/tracking-sessions.md](./geo-tracker/tracking-sessions.md) | available |
| `GET` | `/tracking/sessions/{agentID}/history` | viewer JWT | [geo-tracker/tracking-sessions.md](./geo-tracker/tracking-sessions.md) | available |
| `GET` | `/tracking/sessions/{agentID}/checkpoints` | viewer JWT | [geo-tracker/gps-persistence.md](./geo-tracker/gps-persistence.md) | ✅ **the GPS trail** |
| `GET` | `/tracking/sessions/{agentID}/connections` | viewer JWT | [geo-tracker/tracking-sessions.md](./geo-tracker/tracking-sessions.md) | available — a delivery's reconnect history |
| `POST` | `/routing/route` | viewer JWT | [geo-tracker/routing.md](./geo-tracker/routing.md) | ✅ **the road line between the pins** |
| `POST` | `/routing/eta` | viewer JWT | [geo-tracker/routing.md](./geo-tracker/routing.md) | available |
| `POST` | `/routing/matrix` | viewer JWT | [geo-tracker/routing.md](./geo-tracker/routing.md) | available |
| `GET` | `/routing/geocode` | viewer JWT | [geo-tracker/routing.md](./geo-tracker/routing.md) | available — **`501` on the default `osrm` provider** |
| `GET` | `/routing/reverse-geocode` | viewer JWT | [geo-tracker/routing.md](./geo-tracker/routing.md) | available — same `501` caveat |
| `GET` | `/healthz` | none | [geo-tracker/health.md](./geo-tracker/health.md) | available |
| `GET` | `/readyz` | none | [geo-tracker/health.md](./geo-tracker/health.md) | available |
| `GET` | `/metrics` | none | [geo-tracker/health.md](./geo-tracker/health.md) | operations scrape |

### The 6 it cannot — and why they are not documented here

These are **backend-to-backend**. On the owner's decision (PLAN-3 § 2.3) `webhooks.md`,
`service-data-door.md` and `agent-action-audit.md` are **not mirrored into this repository**:
documenting a surface no client of this app can reach invites somebody to try, and the
credentials involved are a shared HMAC secret and a wi-admin service token that must never
be near a browser bundle. Read them in `backend/geo-tracker/api-doc/` if you need them.

| Method | Path | Auth | Only caller |
|---|---|---|---|
| `POST` | `/webhooks/node` | HMAC-SHA256 | jovi-mall's dispatch worker |
| `POST` | `/webhooks/agent-actions` | HMAC-SHA256 | jovi-mall's dispatch worker |
| `GET` | `/internal/agents/{agentID}/presence` | service token + scope | wi-admin |
| `GET` | `/internal/agents/{agentID}/position` | service token + scope | wi-admin |
| `GET` | `/internal/shipments/{shipmentID}/trail` | service token + scope | wi-admin |
| `GET` | `/internal/shipments/{shipmentID}/events` | service token + scope | wi-admin |

**16 + 6 = 22.** ✅
