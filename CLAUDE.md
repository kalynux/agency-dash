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
- `VITE_APP_NAME` — app display name (default: `"Jovi Mall"`)

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
├── data/                # Mock data (used by all stores)
└── constants/           # locations.json, onboarding-steps.ts
```

### Routing

- `/login` — redirects externally to `http://localhost:3000/login`
- `/onboarding/*` — 3-step flow (logistics → payout → branding), gated by `OnboardingGuard` + `StepGuard`
- `/dashboard/*` — main app, gated by authentication + completed onboarding

**Route guards:** `OnboardingGuard` checks auth; `StepGuard` prevents step skipping using server-driven `role_entity.onboarding_step`.

### State Management

All state is React Context (Zustand is installed but unused). All contexts live in [src/store/index.tsx](src/store/index.tsx) and are composed into a single `StoreProvider`:

| Context | Manages |
|---|---|
| `AuthStoreContext` | `user`, `isAuthenticated`, `login()`, `logout()` |
| `UIStoreContext` | `sidebarCollapsed`, `theme`, `settingsTab` |
| `ProductStoreContext` | Products CRUD + selection |
| `OrderStoreContext` | Orders + status filters |
| `VendorStoreContext` | Vendor approval/suspension/commission |
| `NotificationStoreContext` | Notifications + unread count |
| `AnalyticsStoreContext` | Metrics, sales data, date range |
| `MediaStoreContext` | File/folder management, view mode |

**All stores currently use mock data** from [src/data/mockData.ts](src/data/mockData.ts) with simulated async delays.

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

Only the onboarding service ([src/services/onboarding.service.ts](src/services/onboarding.service.ts)) and auth service ([src/services/auth.service.ts](src/services/auth.service.ts)) currently call the real API. Dashboard stores still use mock data.

### Legacy Compatibility Layer

`App.tsx` maintains `UIContext` and `LegacyAuthContext` context shapes for the `Sidebar` and `Header` components, which haven't been migrated to the new store. It also maps old route strings to React Router paths via `LegacyRouterContext`. Do not remove these shims without refactoring those layout components.

### Key Data Models

- `AgencyOnboardingStep` enum: `0=complete`, `1=logistics`, `2=payout`, `3=branding` — drives route guards
- `AgencyRoleEntity` — full agency profile returned by `/auth/me`
- `ApiUser` — backend user shape; `User` — frontend-normalized shape
