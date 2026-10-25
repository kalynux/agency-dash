import type { TFunction } from 'i18next';
import { formatCurrency, formatDate } from '@/lib/format';
import type { AgencyDamageClaim, EarningsAdjustment } from '@/types/earnings.types';

/**
 * The sentence shown beside an adjustment or a damage claim, in the UI language.
 *
 * The backend writes each one three ways — `reasonCode`, the `reasonParams` it
 * used, and the English `explanation` (see api-doc/agency/earnings.md § Why
 * money was taken back). So:
 *
 * - **English shows `explanation` as sent.** It is the authority, and richer
 *   than our copy (it names the terms behind the window).
 * - **Any other language rebuilds the sentence** from the code and its params.
 * - ⚠ **A code we don't know, or params missing a number we need, falls back
 *   to the English `explanation`** — never to a blank line or a half-filled
 *   template. `refund_beyond_share` / `dispute_payin_fee` are vendor-side and
 *   deliberately left to that fallback.
 */

type AccountT = TFunction<'account'>;

const isEnglish = (lang: string | undefined) => !lang || lang.startsWith('en');

function num(p: Record<string, unknown> | null | undefined, key: string): number | null {
  const v = p?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function str(p: Record<string, unknown> | null | undefined, key: string): string | null {
  const v = p?.[key];
  return typeof v === 'string' && v !== '' ? v : null;
}

function orderRef(t: AccountT, orderNumber: string | null) {
  return orderNumber ? t('earnings.reasons.order', { order: orderNumber }) : t('earnings.reasons.thisOrder');
}

function parcelRef(t: AccountT, trackingNumber: string | null) {
  return trackingNumber
    ? t('earnings.reasons.parcel', { parcel: trackingNumber })
    : t('earnings.reasons.thisParcel');
}

function day(t: AccountT, iso: string | null) {
  return iso ? formatDate(iso) : t('earnings.reasons.unknownDate');
}

interface DamageFacts {
  orderNumber: string | null;
  trackingNumber: string | null;
  itemCount: number;
  maxPerItem: number;
  amount: number;
  investigationFee: number;
  currency: string;
  raisedAt: string | null;
  windowDays: number;
}

function damageSentence(t: AccountT, f: DamageFacts): string {
  const main = t('earnings.reasons.damage_claim', {
    count: f.itemCount,
    order: orderRef(t, f.orderNumber),
    parcel: parcelRef(t, f.trackingNumber),
    raisedAt: day(t, f.raisedAt),
    windowDays: f.windowDays,
    maxPerItem: formatCurrency(f.maxPerItem, f.currency),
    amount: formatCurrency(f.amount, f.currency),
  });
  return f.investigationFee > 0
    ? `${main} ${t('earnings.reasons.investigationFee', { fee: formatCurrency(f.investigationFee, f.currency) })}`
    : main;
}

export function explainAdjustment(t: AccountT, lang: string | undefined, row: EarningsAdjustment): string {
  if (isEnglish(lang)) return row.explanation;
  const p = row.reasonParams;
  const money = (n: number) => formatCurrency(n, str(p, 'currency') ?? row.currency);

  switch (row.reasonCode) {
    case 'refund_share':
    case 'dispute_share': {
      const amount = num(p, 'amount');
      if (amount === null) break;
      const vars = { order: orderRef(t, str(p, 'orderNumber')), amount: money(amount) };
      return row.reasonCode === 'dispute_share'
        ? t('earnings.reasons.dispute_share', vars)
        : t('earnings.reasons.refund_share', vars);
    }
    case 'refund_delivery_fault': {
      const amount = num(p, 'amount');
      const windowDays = num(p, 'windowDays');
      if (amount === null || windowDays === null) break;
      return t('earnings.reasons.refund_delivery_fault', {
        order: orderRef(t, str(p, 'orderNumber')),
        parcel: parcelRef(t, str(p, 'trackingNumber')),
        raisedAt: day(t, str(p, 'raisedAt')),
        deliveredAt: day(t, str(p, 'deliveredAt')),
        windowDays,
        amount: money(amount),
      });
    }
    case 'damage_claim': {
      const itemCount = num(p, 'itemCount');
      const maxPerItem = num(p, 'maxPerItem');
      const amount = num(p, 'amount');
      const windowDays = num(p, 'windowDays');
      if (itemCount === null || maxPerItem === null || amount === null || windowDays === null) break;
      return damageSentence(t, {
        orderNumber: str(p, 'orderNumber'),
        trackingNumber: str(p, 'trackingNumber'),
        itemCount,
        maxPerItem,
        amount,
        investigationFee: num(p, 'investigationFee') ?? 0,
        currency: str(p, 'currency') ?? row.currency,
        raisedAt: str(p, 'raisedAt'),
        windowDays,
      });
    }
    case null: {
      // Written before 2026-10-22: the backend's sentence is built from `kind`.
      const vars = { amount: money(row.amount) };
      if (row.kind === 'refund_clawback') return t('earnings.reasons.refund_clawback', vars);
      if (row.kind === 'clawback_recovery') return t('earnings.reasons.clawback_recovery', vars);
      if (row.kind === 'write_off') return t('earnings.reasons.write_off', vars);
      break;
    }
  }
  return row.explanation;
}

export function explainClaim(t: AccountT, lang: string | undefined, claim: AgencyDamageClaim): string {
  if (isEnglish(lang)) return claim.explanation;
  // The claim carries every fact as a typed field, so `reasonParams` isn't needed.
  return damageSentence(t, claim);
}
