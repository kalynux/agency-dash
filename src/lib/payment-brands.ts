// ─── Payment brands — the one registry every money surface reads ─────────────────
//
// Card networks and mobile-money operators show up in four unrelated places:
// adding a payment method, checkout, the saved-methods list, and payout setup.
// Before this file each of them carried its own literal list, which is how the
// billing screens ended up offering three operators while payout offered five.
//
// Everything a surface needs about a brand lives on the entry: its logo, the
// name to print, the gateway operator it maps to (`null` when the gateway can't
// charge it yet), and the exact string a payout row stores. Surfaces pick a
// *subset* — they never restate the facts.

import type { LucideIcon } from 'lucide-react';
import { Landmark } from 'lucide-react';

import { txStatic } from '@/i18n/tx';
import type { PhoneOperator } from '@/types/billing.types';

import airtelLogo from '@/assets/payment-methods/airtel-money.png';
import mastercardLogo from '@/assets/payment-methods/mastercard.png';
import moovLogo from '@/assets/payment-methods/moov-money.png';
import mtnLogo from '@/assets/payment-methods/mtn-momo.png';
import orangeLogo from '@/assets/payment-methods/orange-money.png';
import visaLogo from '@/assets/payment-methods/visa.png';
import waveLogo from '@/assets/payment-methods/wave.jpg';

export type PaymentBrandId =
  | 'visa'
  | 'mastercard'
  | 'bank'
  | 'mtn'
  | 'orange'
  | 'airtel'
  | 'moov'
  | 'wave';

export interface PaymentBrand {
  id: PaymentBrandId;
  /** The brand as it is written on the box — a proper noun, never translated. */
  name: string;
  /** Compact form for chips and tight tiles ("MTN", not "MTN Mobile Money"). */
  shortName: string;
  /**
   * `billing:` key that replaces `name` for entries that are a category rather
   * than a brand (bank payments). Resolved through `brandLabel`.
   */
  labelKey?: string;
  /** Bundled logo URL. Absent for entries drawn with `icon` instead. */
  logo?: string;
  /** Stand-in mark for a brand with no logo of its own. */
  icon?: LucideIcon;
  /**
   * Intrinsic pixel size of `logo`, so the browser reserves the box before the
   * image lands and the tile never reflows mid-load.
   */
  logoSize?: { width: number; height: number };
  /**
   * The `phoneOperator` the payments gateway is charged with. `null` means the
   * brand is real but the gateway has no enum member for it yet — the backend
   * accepts only MTN/ORANGE/MOOV (payment.validators.ts), so those brands are
   * shown but not selectable anywhere a charge is initiated.
   */
  operator?: PhoneOperator | null;
  /**
   * The literal string a payout row stores in
   * `payout_details[].mobile_money.provider`. These values are already in the
   * database — changing one orphans every agency that picked it.
   */
  payoutProvider?: string;
}

// ─── Card networks ───────────────────────────────────────────────────────────────
// What Stripe collects. `bank` covers the bank-debit and bank-redirect methods
// the Payment Element offers alongside cards, so it has no network logo.

export const VISA: PaymentBrand = {
  id: 'visa',
  name: 'Visa',
  shortName: 'Visa',
  logo: visaLogo,
  logoSize: { width: 320, height: 320 },
};

export const MASTERCARD: PaymentBrand = {
  id: 'mastercard',
  name: 'Mastercard',
  shortName: 'Mastercard',
  logo: mastercardLogo,
  logoSize: { width: 320, height: 320 },
};

export const BANK: PaymentBrand = {
  id: 'bank',
  name: 'Bank payments',
  shortName: 'Bank',
  labelKey: 'billing:brands.bank',
  icon: Landmark,
};

/** Everything the card (Stripe) channel accepts, in the order it is advertised. */
export const CARD_BRANDS: readonly PaymentBrand[] = [VISA, MASTERCARD, BANK];

// ─── Mobile-money operators ──────────────────────────────────────────────────────

export const MOBILE_MONEY_BRANDS: readonly PaymentBrand[] = [
  {
    id: 'mtn',
    name: 'MTN Mobile Money',
    shortName: 'MTN',
    logo: mtnLogo,
    logoSize: { width: 600, height: 600 },
    operator: 'MTN',
    payoutProvider: 'MTN Mobile Money',
  },
  {
    id: 'orange',
    name: 'Orange Money',
    shortName: 'Orange',
    logo: orangeLogo,
    logoSize: { width: 600, height: 600 },
    operator: 'ORANGE',
    payoutProvider: 'Orange Money',
  },
  {
    id: 'airtel',
    name: 'Airtel Money',
    shortName: 'Airtel',
    logo: airtelLogo,
    logoSize: { width: 320, height: 320 },
    operator: null,
    payoutProvider: 'Airtel Money',
  },
  {
    id: 'moov',
    name: 'Moov Money',
    shortName: 'Moov',
    logo: moovLogo,
    logoSize: { width: 225, height: 225 },
    operator: 'MOOV',
    payoutProvider: 'Moov Money',
  },
  {
    id: 'wave',
    name: 'Wave',
    shortName: 'Wave',
    logo: waveLogo,
    logoSize: { width: 669, height: 430 },
    operator: null,
    payoutProvider: 'Wave',
  },
];

/** Operators a payment can actually be initiated with today. */
export const CHARGEABLE_MOBILE_MONEY_BRANDS: readonly PaymentBrand[] =
  MOBILE_MONEY_BRANDS.filter((b) => b.operator != null);

/**
 * Provider strings a payout row may hold, in display order. Payout accepts every
 * operator — money going *out* never touches the payment gateway's enum.
 */
export const MOBILE_MONEY_PAYOUT_PROVIDERS: readonly string[] = MOBILE_MONEY_BRANDS.map(
  (b) => b.payoutProvider!,
);

// ─── Lookups ─────────────────────────────────────────────────────────────────────

const ALL_BRANDS: readonly PaymentBrand[] = [...CARD_BRANDS, ...MOBILE_MONEY_BRANDS];

/**
 * Resolve whatever a record calls its brand to a registry entry.
 *
 * The same operator arrives spelled several ways depending on where it was
 * written: `SavedPaymentMethod.brand` holds the gateway's own casing (`visa`,
 * `MTN`), a payout row holds the full marketing name (`MTN Mobile Money`), and
 * Stripe reports networks lowercased. Match on the id, the operator, and the
 * payout string, then fall back to a substring so `mtn_momo` still lands on MTN.
 * Returns `null` for a brand we have no logo for — callers draw a generic mark.
 */
export function resolveBrand(raw: string | null | undefined): PaymentBrand | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;

  const exact = ALL_BRANDS.find(
    (b) =>
      b.id === value ||
      b.name.toLowerCase() === value ||
      b.operator?.toLowerCase() === value ||
      b.payoutProvider?.toLowerCase() === value,
  );
  if (exact) return exact;

  // `mtn_momo`, `orange_money`, `master card`, … — one-sided containment only, so
  // a two-letter id can't swallow an unrelated string.
  return ALL_BRANDS.find((b) => value.includes(b.id) || value.includes(b.shortName.toLowerCase())) ?? null;
}

/** The brand backing a gateway operator enum member. */
export function brandForOperator(operator: PhoneOperator): PaymentBrand | undefined {
  return MOBILE_MONEY_BRANDS.find((b) => b.operator === operator);
}

/**
 * The label to print. Brands print their own name; category entries resolve
 * their key against the live language, so call this at render time.
 */
export function brandLabel(brand: PaymentBrand): string {
  if (!brand.labelKey) return brand.name;
  const label = txStatic(brand.labelKey);
  return label === brand.labelKey ? brand.name : label;
}
