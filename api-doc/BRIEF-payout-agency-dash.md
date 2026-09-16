# agency-dash — payout statuses changed

**Backend change:** 2026-09-15 · **Not deployed yet** — build against the docs.
**Size:** small, but **breaking**. One screen. Probably an hour.

---

## Read this

| Doc | Section |
|---|---|
| `jovi-mall/api-doc/agency/earnings.md` | **§ `status`** — the table of five values |

---

## What changed

`GET /api/agency/earnings/payout` returns `status`, and it now has **five** values instead of
three. `processing` and `failed` are new.

| `status` | Means | Agency's money is | Say |
|---|---|---|---|
| `pending` | Waiting for an administrator | held | "Being reviewed" |
| `processing` | **Sent to the payment provider, not yet confirmed** | held | "On its way" — **never** "Paid" |
| `paid` | Settled | gone to them | "Paid" |
| `rejected` | Closed. `rejectionReason` says why | **back in `available`** | "Declined — &lt;reason&gt;" |
| `failed` | **The transfer was refused** | **still held** | "Payment failed — we're looking into it" |

---

## Why this is breaking rather than additive

If your status map was exhaustive over the old three — a ternary, a switch with a default, an
`else` — the two new values fall into whichever branch was last. In most implementations that is
the `rejected` branch.

**That tells an agency their payout was declined while their money is actually in flight.**

---

## Three rules

⛔ **`failed` does not mean the request is over, and it does not give the money back.** The balance
stays reserved while an administrator retries or closes it. Only `rejected` returns money to
`available`.

⛔ **Gate the "Request payout" control on all three open statuses** — `pending`, `processing`,
`failed`. Pressing it while any is live returns `409 EARNINGS_PAYOUT_ALREADY_PENDING`.

⛔ **Treat an unrecognised status as in-progress, never as failure.**

---

## ✅ Your COD screens are unaffected — deliberately

Administrators gained a review step on COD remittances and deposits in the same change. **Nothing
about it reaches you.**

- `AgencyRemittance` and `AgentDeposit` gained a `triage` field, and it is **excluded from every
  agency-facing response.** The endorsement carries an internal note written by one administrator
  for the next — commentary about the counterparty, and the counterparty is not its audience.
- The `declared → confirmed | rejected` machine is **unchanged**. No new status, no new field, no
  new refusal.
- **Your own deposit-confirmation flow is untouched.** An agency-recipient deposit is still
  confirmed by you, and an administrator cannot review or intercept it — the backend refuses them
  on those (`403 COD_DEPOSIT_WRONG_RECIPIENT`). That handover is already counter-signed by two
  organisations, which is a stronger control than two admin tiers.

So: **no work on COD.** It is listed here only so you do not go looking for it.

---

## One thing that has not changed

`rejectionReason` is still the only place the *why* lives. The WhatsApp notification
(`agency_payout_rejected`) carries only the currency and the amount and points at Tickets — so
**your screen is where they read the reason.**

---

## Acceptance

- [ ] `processing` and `failed` each render distinctly, from an explicit branch.
- [ ] Neither falls through to the `rejected` branch.
- [ ] `processing` never reads as "Paid".
- [ ] `failed` does not invite a new request, and does not claim the money is back.
- [ ] "Request payout" is disabled on `pending`, `processing` **and** `failed`.
- [ ] An unknown status renders as in-progress.
- [ ] `rejectionReason` is shown on a rejected payout.
- [ ] No COD screen was changed.
