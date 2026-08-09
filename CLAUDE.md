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
- `VITE_API_BASE_URL` — backend base URL (default: `http://localhost:8022/api`)
- `VITE_APP_NAME` — app display name (default: `"WiMall"`)

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

- `/login` — redirects externally to `http://localhost:3000/login`
- `/onboarding/*` — 3-step flow (logistics → payout → branding), gated by `OnboardingGuard` + `StepGuard`
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
analytics/ticket/storage stores and `src/data/mockData.ts` were deleted once no
screen read them; several types in [src/types/index.ts](src/types/index.ts)
(`Order`, `Customer`, `AnalyticsMetrics`, `StorageItem`, …) are leftovers from
that era and have no consumer.

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
api.patch<T>(path, body?)
api.put<T>(path, body?)
api.delete<T>(path)
```

Every service and feature store calls the real API — there is no mock data left
in the app.

### Legacy Compatibility Layer

`App.tsx` maintains `UIContext` and `LegacyAuthContext` context shapes for the `Sidebar` and `Header` components, which haven't been migrated to the new store. It also maps old route strings to React Router paths via `LegacyRouterContext`. Do not remove these shims without refactoring those layout components.

### Key Data Models

- `AgencyOnboardingStep` enum: `0=complete`, `1=logistics`, `2=payout`, `3=branding` — drives route guards
- `AgencyRoleEntity` — full agency profile returned by `/auth/me`
- `ApiUser` — backend user shape; `User` — frontend-normalized shape
