# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server on port 5174
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint (flat config, ESLint 9+)
npm run preview    # Preview production build
```

No test runner is configured.

## Architecture

**Stack:** React 19, TypeScript 5.9, Vite 7, React Router v6, Tailwind CSS 3.4, shadcn/ui (Radix UI), React Hook Form + Zod, Recharts, Framer Motion.

**Path alias:** `@` maps to `./src`.

**Environment variables:**
- `VITE_API_BASE_URL` — backend base URL (default: `http://localhost:8022/api`; production `https://api.wi-mall.com/api`)
- `VITE_APP_NAME` — app display name (default: `"Wi-Agency"`)
- `VITE_LOGIN_URL` — where `/login` redirects (default: `http://localhost:3000/login`; production `https://wi-mall.com/login`)

Env files live in `env/`, not the project root (`vite.config.ts` → `envDir`).
`.env.development` and `.env.production` are both committed; see [env/README.md](env/README.md).

**Naming:** the platform is **Wi-Mall** (`wi-mall`), this app is **Wi-Agency**
(`wi-agency`). Always hyphenated — `wimall.com` is another company's domain.
Production hosts: `agency.wi-mall.com` (this app), `agent.wi-mall.com`,
`vendor.wi-mall.com`, `api.wi-mall.com`, `wi-mall.com` (main site).

### App Structure

```
src/
├── App.tsx              # Root routing, legacy context shims, route guards
├── main.tsx             # Entry: BrowserRouter + StoreProvider
├── store/index.tsx      # All React Context stores
├── services/            # api.ts (fetch client), auth.service.ts, onboarding.service.ts
├── pages/               # Page components (one per route)
├── components/
│   ├── ui/             # shadcn/ui presentational components (do not modify lightly)
│   ├── features/       # Business logic components
│   └── layout/         # Sidebar, Header
├── onboarding/          # Self-contained onboarding subsystem
│   ├── store/          # Onboarding-specific context
│   ├── schemas/        # Zod schemas for onboarding forms
│   └── steps/          # Step page components
├── types/               # Shared TypeScript types
└── constants/           # locations.json, onboarding-steps.ts
```

### Routing

- `/login` — redirects externally to `VITE_LOGIN_URL` (the main Wi-Mall site's login)
- `/onboarding/*` — 4-step flow (logistics → payout → branding → policies), gated by `OnboardingGuard` + `StepGuard`. Each step is its own `PUT /api/agency/onboarding/{logistics,payout,branding,policies}`; there is no `PATCH .../onboarding/step`
- `/dashboard/*` — main app, gated by authentication + completed onboarding

**Route guards:** `OnboardingGuard` checks auth; `StepGuard` prevents step skipping using server-driven `role_entity.onboarding_step`.

### State Management

All state is React Context (Zustand is installed but unused).

[src/store/index.tsx](src/store/index.tsx) holds `StoreProvider` / `useUIStore`, which
owns only the theme (`theme`, `resolvedTheme`, `setTheme`) plus sidebar collapse.
Note the layout's sidebar state actually comes from `UIContext` in
[src/App.tsx](src/App.tsx), not from this store.

Every feature store is its own file and calls the real API:

| Provider | File | Manages |
|---|---|---|
| `ShipmentsProvider` | `store/shipments.store.tsx` | Shipments + assignment |
| `AgentsRosterProvider` | `store/agents.store.tsx` | Agent roster + contracts |
| `NotificationsProvider` | `store/notifications.store.tsx` | Notifications + unread count |
| `VendorConnectionsProvider` | `store/vendorConnections.store.tsx` | Vendor connections |
| `MagazinProvider` | `store/magazin.store.tsx` | Store (magazin) profile |

They are mounted in [src/App.tsx](src/App.tsx). The mock product/order/vendor/
analytics/ticket/storage stores, `src/data/mockData.ts` and the leftover
`src/types/index.ts` barrel (`Order`, `Customer`, `AnalyticsMetrics`,
`StorageItem`, …) were all deleted once nothing read them. Every type now lives
in a named file under `src/types/`, imported by its full path — there is no
`@/types` barrel to import from.

The onboarding subsystem has its own context at [src/onboarding/store/onboarding.store.tsx](src/onboarding/store/onboarding.store.tsx). It caches form drafts before API calls to support back-navigation without data loss.

### API Layer

[src/services/api.ts](src/services/api.ts) — native `fetch` with:
- Cookie-based auth (`credentials: 'include'`)
- Automatic 401 → token refresh with a **request queue** to prevent concurrent refresh races
- Hard logout (`window.dispatchEvent(new Event('auth:logout'))`) on refresh failure
- Custom `ApiError` class with `status`, `code`, `message`, `details`, `requestId`

```typescript
api.get<T>(path)
api.post<T>(path, body?)
api.postForm<T>(path, formData)   // multipart uploads
api.patch<T>(path, body?)
api.put<T>(path, body?)
api.delete<T>(path, body?)
api.getBlob(path)                 // authorized files — raw bytes, not an envelope
```

`getBlob` exists for the three storage trees that left the public file mount on
2026-08-19 (`digital/`, `shipments/`, `ticket-attachments/`). Their `FileDetail`
carries `url: null` / `access: 'authorized'`, so the bytes must be fetched **with
the session** and turned into an object URL. For this dashboard that means every
delivery-proof photo — see
[api-doc/files/private-files.md](api-doc/files/private-files.md).

Every service and feature store calls the real API — there is no mock data left
in the app.

### Legacy Compatibility Layer

`App.tsx` maintains `UIContext` and `LegacyAuthContext` context shapes for the `Sidebar` and `Header` components, which haven't been migrated to the new store. It also maps old route strings to React Router paths via `LegacyRouterContext`. Do not remove these shims without refactoring those layout components.

### Key Data Models

- `AgencyOnboardingStep`: `0=complete`, `1=logistics`, `2=payout`, `3=branding` (skippable), `4=policies` — drives route guards
- `AgencyRoleEntity` — full agency profile returned by `/auth/me`
- `ApiUser` — the backend user shape (`src/types/api.ts`)

### Three things this dashboard gets wrong if nobody says them

1. **`permission_revoked` has three reasons and only one is about a delivery.**
   Branch on `payload.reason` before writing any outcome into the UI; treat an
   unrecognised value as `authorization_expired`. See
   [api-doc/MIGRATION-2026-08.md](api-doc/MIGRATION-2026-08.md) § 2.
2. **Build the live map from `GET /api/agency/tracking/board`, never from a
   locally-derived "active shipments" set.** Three status subsets disagree —
   `failed` is *active* but not *trackable*.
3. **An inventory row with `source: "derived"` and quantities of `0` has not been
   counted.** That is not "we hold none"; render the two differently.
