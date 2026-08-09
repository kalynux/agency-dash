# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: the **owner/operator of a delivery agency** — a small last-mile
logistics business that fulfills orders for the WiMall marketplace. This person
is hands-on and wears every hat: they accept shipments from vendors, dispatch
them to their own agents, watch deliveries on a live map, handle cash-on-delivery
money and its reconciliation with the platform, manage billing, and chase the
delivery-fee earnings the agency is owed. They work from both desktop (full
sidebar) and mobile (tab bar + drawer), often on the move.

This app is the **agency-role console** of a larger multi-role platform. The
platform also has customer, vendor, agent, and admin roles, each with its own
surface; those are out of scope for this dashboard but define the actors this
operator interacts with (vendors send them work, agents do the deliveries, admins
process payouts and oversee cash).

## Product Purpose

WiMall is a combined e-commerce + logistics marketplace in which last-mile
delivery is a first-class role with its own economy. This dashboard is the
operating console a delivery agency uses to run that side of the business end to
end: receive dispatched shipments, offer them to agents and track acceptance,
follow deliveries live, run the full cash-on-delivery money chain, reconcile with
the platform, connect with vendors, and get paid.

Success means the operator can run their entire delivery operation and its cash
flow from this one place, and always trust what it says about money and shipment
state.

## Positioning

The distinctive mechanism is that delivery is not an afterthought bolted onto a
storefront — it is a fully modeled, cash-aware logistics layer:

- **Offer/accept assignment**, not push: an agency offers a shipment to one of
  its agents, who must accept before pickup; the shipment gains an agent only on
  acceptance.
- **A complete COD cash chain** — collect (via a customer delivery code) →
  deposit → remit → admin-confirm — with a rolling reserve (default 10%, 30 days)
  that only releases while the agency has no open cash discrepancies.
- **Split delivery-fee earnings**: each fee is divided between agency and the
  delivering agent per their contract, earned at delivery, released after the
  order completes and a hold window elapses (and, for COD, after the cash
  settles).
- **Live agent GPS tracking** via a separate real-time service, gated by a
  server-side "who may this viewer track?" authorization policy.

Taken together this is a cash-and-logistics operating system for independent
delivery agencies in African markets, not a generic e-commerce admin panel.

## Operating Context

- **Two backend services, one identity.** `wimall` (Express + TypeScript +
  MongoDB, HTTP only) owns users, orders, shipments, money, and the tracking
  authorization policy; `geo-tracker` (Go + Redis + Postgres, WebSocket) owns
  live positions, the tracking stream, and routing. The same JWT signs both; a
  live map talks to both.
- **Roles and sessions.** Every account holds one or more of
  `customer · vendor · agency · agent · admin`; a session is scoped to one active
  role. This app is the `agency` surface.
- **Auth lives on the main site.** This dashboard's `/login` is a placeholder that
  redirects to the platform login; cookie-first JWT with silent server-side
  refresh, a refresh request-queue to avoid races, and a hard-logout event on
  refresh failure.
- **Gated onboarding.** A server-driven, step-gated onboarding flow
  (logistics → payout → branding → policies) must be completed before the
  dashboard is reachable; the current step drives route guards and cannot be
  skipped.
- **Shipment visibility.** A shipment exists at customer checkout but is invisible
  to the agency until the vendor dispatches the paid order (or auto-redirect
  fires) — that vendor dispatch is the review step that puts work on the agency's
  board.
- **Money and notifications.** Payments run through Stripe; payouts are handled
  out-of-band by an admin (bank transfer / mobile money) and tracked through a
  `PAYOUT_REQUEST` support ticket. Notifications reach the operator in-app and via
  push (Firebase), WhatsApp, and Telegram.
- **Currency** defaults to XAF (Central African CFA franc).

## Capabilities and Constraints

**Feature areas (all implemented surfaces, not placeholders):** Overview;
Shipments (offer/accept assignment, full status lifecycle, agent-to-agent
reassignment, reject, tracking number); Live Tracking (Leaflet map fed by the
geo-tracker WebSocket); Media / file management (per-role storage quotas);
Transactions; Cash Management (Summary, Deposits, Remittances, Discrepancies);
Notifications; Tickets (including payout-request tickets); Agents (roster,
invites, memberships, `fee_split` contracts); Vendors (connections, browse);
Account (profile, store, locations, security, billing, payout); Settings
(policies, notifications, preferences).

**Stack (existing codebase, do not re-decide):** React 19, TypeScript 5.9,
Vite 7, React Router v6, Tailwind CSS 3.4, shadcn/ui (Radix UI), React Hook Form
+ Zod, Recharts, Framer Motion, Leaflet, Firebase (push), Stripe, Sonner,
next-themes. `@` path alias maps to `./src`. Responsive: desktop sidebar +
mobile tab bar / more-drawer. Dev server on port 5174. No test runner is
configured.

**API contract.** Every endpoint returns a uniform envelope —
`{ success, data, meta }` on success, `{ success, error: { code, message, … } }`
on failure. Branch on the stable `error.code`, never the human `message`.
Validation errors carry `details.fields[]` to map to form fields.

**State.** All app state is React Context stores in `src/store` composed into one
provider; Zustand is installed but unused. Several domains are on the real API
(onboarding, auth, shipments, agents, notifications, vendor connections) while
other dashboard areas still run on mock data (`src/data/mockData.ts`) with
simulated delays — a real, in-progress migration. Future work must not assume
every screen is backed by live data.

**Legacy shims.** `App.tsx` keeps `UIContext`/`LegacyAuthContext`/legacy-router
context shapes for the Sidebar/Header; do not remove without refactoring those
layout components.

**Explicitly not-yet-active product facts (do not imply they exist in the UI):**
per-kg weight surcharges, out-of-region surcharges, peak-season surcharges,
monthly per-SKU storage rent, and the failed-delivery fee are defined in the
pricing policy but are **not yet charged**. `rto_fee` (return-to-origin) and the
COD handling fee **are** charged. Payouts are full-balance only (no partial), with
a 10,000 XAF minimum and an automatic sweep at 2,000,000 XAF.

## Brand Commitments

- **Product name: WiMall** (canonical, per the project owner). Written as one
  word, capital W and capital M — not "Wi Mall", not "wi-mall", and never the
  legacy "Jovi Mall" / `jovi-mall`. Lowercase identifier slots (package name,
  service ids) use `wimall`.
- **Visual identity is not yet established.** No confirmed logo, palette,
  typography, or brand voice has been provided. Do not fabricate brand guidelines;
  a visual world is decided later in design work, not here.

## Evidence on Hand

- **Authoritative backend contract** in `api-doc/` — extensive per-role,
  per-feature HTTP documentation plus a shared conventions/error catalog. This is
  the source of truth for backend behavior.
- **A working, implemented UI** across every feature area listed above, built on
  the shadcn/ui component set.
- **Mock data** in `src/data/mockData.ts` for the areas not yet wired to the API.
- **Absences future work must not invent:** there are no real customer
  testimonials, case studies, press mentions, production usage metrics, or real
  screenshots on hand. Any marketing/persuade surface must source real content or
  leave it clearly as a placeholder.

## Product Principles

1. **Money is the spine.** Cash accountability — the COD chain, reserves,
   discrepancies, earnings holds, payout state — must always be legible and
   trustworthy. Never obscure where money is or why it is held.
2. **Design for one busy operator.** Surface what needs action now (offers to
   accept, cash to remit, open discrepancies, expiring plans) ahead of vanity
   metrics; the operator has no dedicated staff to babysit any single screen.
3. **The server owns the truth.** Role, onboarding step, balances, and every
   shipment status transition are server-driven and rule-bound. The UI reflects
   state and honors the contract (offer/accept, the status lifecycle, error
   codes); it never invents state or implies unshipped capabilities.
4. **Multi-country, multilingual from the start.** Every layout and string must
   survive translation and localization, including right-to-left Arabic and
   varied currency/date/address/phone formats.
5. **Trust is earned in the details.** For a cash-handling tool aimed at small
   operators, correctness, clarity, and reliability of state outrank flourish.

## Accessibility & Inclusion

- **Internationalization is a hard requirement.** Launch is Cameroon-first, with
  rollout across many African countries. Supported languages: **English, French,
  Portuguese, Spanish, and Arabic** — Arabic requires full **right-to-left**
  support. Currency (default XAF), numbers, dates, addresses, and phone formats
  must localize per market.
- The repository claims WCAG 2.1 AA, keyboard navigation, and screen-reader
  support; treat this as a standard to uphold and verify, not as confirmed.
