# Internationalization

The dashboard renders in the language the agency picked on **Account → Profile**.
That one choice is `preferred_language` on the agency profile — the same field
the backend uses to render notifications — so the UI and the emails/WhatsApp
messages can never disagree.

## Layout

```
src/i18n/
  config.ts               supported languages, default, storage key, Intl locales
  namespaces.ts           the namespace list (one per feature area)
  index.ts                i18next bootstrap + changeLanguage()
  resources.ts            English bundled eagerly, other locales code-split
  i18next.d.ts            makes t() keys type-checked against en/*.json
  tx.ts                   the one escape hatch for runtime-computed keys
  LanguageProvider.tsx    React context: language, setLanguage, syncFromProfile
  ProfileLanguageSync.tsx adopts preferred_language once /auth/me answers
  locales/<lang>/<ns>.json
```

`lib/errors.ts` resolves backend `error.code` → `errors:codes.*`.
`lib/validation-schemas.ts` and `onboarding/schemas/*` build Zod schemas from `t`.
`lib/format.ts` formats numbers, currency and dates in the active locale.
`lib/direction.ts` mirrors the shell for right-to-left languages.

## Adding a language

1. Add a row to `SUPPORTED_LANGUAGES` in `config.ts`.
2. Create `locales/<code>/` and drop in JSON files named after the namespaces.
   Anything you don't translate falls back to English **per key**, so a partial
   locale is a normal, shippable state.
3. Nothing else. The picker, the direction, the `Intl` formatting and the lazy
   chunk all derive from that table.

## Adding a string

Never write user-visible copy inline. Put it in the namespace that matches the
feature, then:

```tsx
const { t } = useTranslation('shipments');
<h1>{t('page.title')}</h1>
```

Cross-namespace keys need the namespace declared:

```tsx
const { t } = useTranslation(['shipments', 'common']);
<Button>{t('common:actions.retry')}</Button>
```

Keys are **type-checked** against the English bundle — a typo is a build error.

### Plurals

Use i18next's `count`, never string concatenation or a ternary:

```json
{ "shipments_one": "{{count}} shipment", "shipments_other": "{{count}} shipments" }
```

```tsx
t('attention.shipments', { count })
```

Arabic has six plural categories and French treats 0 as singular; a hand-rolled
`n === 1 ? 'x' : 'xs'` is wrong in both.

### Copy with markup in the middle

Use `<Trans>` so a translator can move the emphasised phrase:

```tsx
<Trans ns="account" i18nKey="earnings.howItWorks" components={{ strong: <b /> }} />
```

### Runtime-computed keys

Config tables (`config/navigation.ts`), backend enums and error codes carry
their key as data. Those go through `tx(t, key)` — grep for `tx(` to find every
place a key isn't compile-time checked. Pair them with an exhaustive
`Record<Enum, Key>` map so a missing entry still fails somewhere.

### Validation messages

Zod schemas are **factories** taking `t`, because a module-scope schema would
freeze its messages in whatever language was active at import:

```tsx
const schema = useMemo(() => buildPayoutSchema(t), [t]);
useForm({ resolver: zodResolver(schema) });
```

### Backend errors

Never render `error.message` — it is English server copy. Call
`getApiErrorMessage(err)`, which maps `error.code` through `errors:codes.*` and
falls back to a generic localized message. `scripts/i18n-audit.mjs` fails if a
code declared in `api-doc/error-codes.ts` has no entry.

## Checking coverage

```bash
npm run i18n:audit    # report: per-locale completeness + unmapped error codes
npm run i18n:check    # same, but exits 1 on a hole in English or the catalog
```

## Migration status

Every user-visible surface is translated, and French is a complete locale
(`npm run i18n:audit` reports 100%). `es`, `pt` and `ar` carry `common`, `nav`
and `errors` only and fall back to English per key — a normal, shippable state.

| Surface | State |
|---|---|
| Error catalog (469 backend codes) | done |
| Navigation, sidebar, header, mobile shell | done |
| Shared components (states, filters, dialogs, hints, address search) | done |
| Account → Profile / Security / Payout / Earnings | done |
| Account → Store (magazin), Locations | done |
| Settings → page shell, Preferences | done |
| Settings → Policies, Notifications, channel setup dialogs | done |
| Overview | done |
| Login placeholder | done |
| Shipments (page, detail, assignment, reassign, reject, row actions) | done |
| Cash Management (summary, deposits, remittances, discrepancies) | done |
| Vendors (browse, connections, card, detail, filters) | done |
| Notifications | done |
| Agents (browse, connections, membership dialog, detail sheet, status/terms panels) | done |
| Tickets (list, detail, create, notes, attachments, entity picker, FAQ) | done |
| Onboarding (layout, steps 1–4, error boundary) | done |
| Billing (plan, wallet, storage, plans, methods, checkout, Stripe) | done |
| Transactions | done |
| Media Library + Media Picker + upload validation | done |
| Live Tracking (board, map popups, agent cards, shipment pins) | done |

### Deliberately not translated

- **Brand and product names** — `Jovi Mall`, `MTN Mobile Money`, `NotchPay`,
  `Stripe`, `Telegram`, storage-provider names.
- **Language names** in the notification-language picker: each is written in
  its own language (`Français`, `العربية`), never translated into the current one.
- **Timezone rows** (`Douala (WAT, UTC+1)`) — a city name plus a UTC offset.
- **Country names** in the payout bank picker, which go through
  `Intl.DisplayNames` rather than a namespace; the stored *value* stays English
  because that is what the backend persists.
- **Region names**, which carry their own per-language strings inside
  `constants/locations.json` — see `regionsFor(country, language)`.
- `components/features/LoginForm.tsx` and `pages/Login.tsx`, which are
  unreachable: `/login` renders `LoginRedirectScreen` in `App.tsx`.
- The legacy mock-data stores in `store/index.tsx` (products, orders, vendors,
  analytics, media), which no screen reads any more.

Notification titles, messages and action labels are **not** in this table:
the backend renders them in the agency's `preferred_language`, which is the same
setting that drives the dashboard, so they arrive already translated.
