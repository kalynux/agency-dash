// ─── Payout entries — the list's view model ──────────────────────────────────
//
// One saved payout destination, as the editor holds it and as a row prints it.
// Kept out of the components so both the settings tab and onboarding read a row
// the same way, and so the "is this entry actually sendable?" question has one
// answer instead of one per screen.

import type { AnyTFunction } from '@/i18n/tx';
import { formatPhoneDisplay } from '@/lib/phone';
import type { PaymentMethodType } from '@/types/payment-method.types';
import type { PayoutDetails } from '@/types/api';
import { SENDABLE_PAYOUT_METHODS } from '@/onboarding/schemas/onboarding.schemas';
import type { CardBrandValue, PayoutMethodFormValue } from '@/onboarding/schemas/onboarding.schemas';

/**
 * A row in the editor: exactly what the schema accepts, plus the mask the API
 * returned for the secret this shape cannot hold.
 *
 * Payout secrets are write-mostly — a read gives back `••••0000`, never the
 * stored number — so an entry seeded from the server carries an EMPTY
 * `phone_number` / `account_number` and its mask alongside. The mask is display
 * only; the schema strips it on save, which is why every write runs through
 * `buildPayoutSchema` rather than being sent as held.
 */
export type PayoutEntry = PayoutMethodFormValue & { masked_detail?: string | null };

/** Card networks print their own name; only the catch-all is translated. */
const CARD_BRAND_NAMES: Record<Exclude<CardBrandValue, 'other'>, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  unionpay: 'UnionPay',
  jcb: 'JCB',
  diners: 'Diners Club',
  verve: 'Verve',
};

export function cardBrandLabel(brand: CardBrandValue, t: AnyTFunction): string {
  return brand === 'other' ? (t('payout.cardBrandOther') as string) : CARD_BRAND_NAMES[brand];
}

/**
 * Saved payout details → editable rows.
 *
 * `card` is the one kind that survives a read intact (nothing sensitive is
 * stored for it), so it round-trips; the other two come back masked and are
 * seeded blank, which is what makes them show as incomplete until re-entered.
 */
export function toPayoutEntries(saved: PayoutDetails | null | undefined): PayoutEntry[] {
  if (!saved?.length) return [];
  return saved.map((entry): PayoutEntry => {
    if (entry.method === 'bank') {
      const bank = entry.bank;
      return {
        method: 'bank',
        bank: {
          bank_name: bank?.bank_name ?? '',
          account_number: bank?.account_number ?? '',
          account_name: bank?.account_name ?? '',
          country: bank?.country ?? '',
        },
        mobile_money: null,
        card: null,
        masked_detail: bank?.account_number_masked ?? null,
      };
    }
    if (entry.method === 'card') {
      const card = entry.card;
      return {
        method: 'card',
        card: {
          brand: (card?.brand ?? 'other') as CardBrandValue,
          last4: card?.last4 ?? '',
          card_holder_name: card?.card_holder_name ?? '',
          expiry_month: card?.expiry_month ?? 0,
          expiry_year: card?.expiry_year ?? 0,
          country: card?.country ?? '',
          issuing_bank: card?.issuing_bank ?? null,
        },
        mobile_money: null,
        bank: null,
      };
    }
    const mm = entry.mobile_money;
    return {
      method: 'mobile_money',
      mobile_money: {
        provider: mm?.provider ?? '',
        phone_number: mm?.phone_number ?? '',
        account_name: mm?.account_name ?? '',
      },
      bank: null,
      card: null,
      masked_detail: mm?.phone_number_masked ?? null,
    };
  });
}

/**
 * Why this row cannot be saved, or `null` when it can.
 *
 * Two distinct blockers, and the difference matters to the user:
 * - `switched_off` — the kind itself is refused right now. Nothing the user
 *   types fixes it; the row has to be replaced. This is reachable only for an
 *   entry saved BEFORE the switch, since the picker already bars choosing one
 *   anew.
 * - `incomplete` — a write-mostly secret came back masked and has not been
 *   re-typed.
 */
export function payoutEntryBlocker(entry: PayoutEntry): 'switched_off' | 'incomplete' | null {
  if (!SENDABLE_PAYOUT_METHODS.includes(entry.method)) return 'switched_off';
  const mm = entry.mobile_money;
  return mm?.provider && mm.phone_number && mm.account_name ? null : 'incomplete';
}

/**
 * Is this row sendable as it stands?
 *
 * `payout_details` is a full replace, so ONE bad row fails the whole save —
 * whether it is missing a re-entered secret or is a kind that is currently
 * switched off, and wherever it sits in the list. The list badges those rather
 * than letting the user find out from a 400 that names an index.
 */
export function isPayoutEntryComplete(entry: PayoutEntry): boolean {
  return payoutEntryBlocker(entry) === null;
}

/** What the row's mark is drawn from — the operator, the network, or the channel. */
export function payoutEntryMark(entry: PayoutEntry): {
  brand: string | null;
  methodType: PaymentMethodType;
} {
  if (entry.method === 'mobile_money') {
    return { brand: entry.mobile_money?.provider ?? null, methodType: 'mobile_money' };
  }
  if (entry.method === 'bank') return { brand: 'bank', methodType: 'bank_transfer' };
  return { brand: entry.card?.brand ?? null, methodType: 'card' };
}

/** The row's headline — the destination as its owner would name it. */
export function payoutEntryTitle(entry: PayoutEntry, t: AnyTFunction): string {
  if (entry.method === 'mobile_money') {
    return entry.mobile_money?.provider || (t('payout.mobileMoney') as string);
  }
  if (entry.method === 'bank') {
    return entry.bank?.bank_name || (t('payout.bankTransfer') as string);
  }
  return entry.card ? cardBrandLabel(entry.card.brand, t) : (t('payout.card') as string);
}

/** `MM/YY`, the way it is embossed. */
export function formatCardExpiry(month: number, year: number): string {
  if (!month || !year) return '';
  return `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
}

/**
 * The row's second line: the account, then the name on it. Falls back to the
 * server's mask while the raw secret is missing, so an untouched entry still
 * shows *which* number it is.
 */
export function payoutEntryDetail(entry: PayoutEntry): string {
  const parts: (string | undefined | null)[] =
    entry.method === 'mobile_money'
      ? [
          formatPhoneDisplay(entry.mobile_money?.phone_number) || entry.masked_detail,
          entry.mobile_money?.account_name,
        ]
      : entry.method === 'bank'
        ? [entry.bank?.account_number || entry.masked_detail, entry.bank?.account_name]
        : [
            entry.card?.last4 ? `•••• ${entry.card.last4}` : null,
            entry.card ? formatCardExpiry(entry.card.expiry_month, entry.card.expiry_year) : null,
            entry.card?.card_holder_name,
          ];
  return parts.filter(Boolean).join(' · ');
}
