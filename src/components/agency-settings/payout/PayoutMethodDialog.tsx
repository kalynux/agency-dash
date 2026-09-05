import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, CreditCard, Smartphone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResponsiveModal } from '@/components/common/ResponsiveModal';
import { PhoneInput } from '@/components/common/PhoneInput';
import { PaymentOptionGroup } from '@/components/common/PaymentOptionGroup';
import { PaymentOptionSelect } from '@/components/common/PaymentOptionSelect';
import { brandOptions, type PaymentOption } from '@/components/common/payment-options';
import { MOBILE_MONEY_BRANDS } from '@/lib/payment-brands';
import { countryOptions } from '@/lib/countries';
import {
  buildPayoutMethodSchema,
  CARD_BRANDS,
  CARD_EXPIRY_YEARS,
  type CardBrandValue,
  type PayoutMethodType,
} from '@/onboarding/schemas/onboarding.schemas';
import { cardBrandLabel, type PayoutEntry } from './payoutEntry.helpers';

export interface PayoutMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The entry being edited, or `null` when adding a new one. */
  entry?: PayoutEntry | null;
  /**
   * Hide the "make this the preferred method" switch: this entry lands at index
   * 0 whatever the user picks (it is the only one, or it already is index 0).
   */
  forcePreferred?: boolean;
  /** Receives a complete entry plus whether it should move to the front. */
  onSave: (entry: PayoutEntry, makePreferred: boolean) => void;
}

/**
 * Add / edit one payout destination — a kind first, then only the fields that
 * kind needs.
 *
 * Nothing is sent from here. The entry goes back to the list and the surrounding
 * surface performs the single full-replace write the profile API expects, which
 * is the only write there is: `payout_details` has no per-entry endpoint.
 *
 * Fields are seeded once, at mount, so the list must remount this with a fresh
 * `key` each time it opens (see `PayoutMethodsEditor`). Remounting on *open*
 * rather than on close is what preserves the sheet's exit animation.
 */
export function PayoutMethodDialog({
  open,
  onOpenChange,
  entry = null,
  forcePreferred = false,
  onSave,
}: PayoutMethodDialogProps) {
  const { t, i18n } = useTranslation(['account', 'common']);
  const fieldId = useId();
  const schema = useMemo(() => buildPayoutMethodSchema(t), [t]);
  const countries = useMemo(() => countryOptions(i18n.language), [i18n.language]);

  const seedMm = entry?.method === 'mobile_money' ? entry.mobile_money : null;
  const seedBank = entry?.method === 'bank' ? entry.bank : null;
  const seedCard = entry?.method === 'card' ? entry.card : null;

  const [method, setMethod] = useState<PayoutMethodType>(entry?.method ?? 'mobile_money');
  const [provider, setProvider] = useState(seedMm?.provider ?? '');
  const [phone, setPhone] = useState(seedMm?.phone_number ?? '');
  // Shared by all three kinds: switching kind should not lose a name already
  // typed — it is the same person being paid either way.
  const [accountName, setAccountName] = useState(
    seedMm?.account_name ?? seedBank?.account_name ?? seedCard?.card_holder_name ?? '',
  );
  const [bankName, setBankName] = useState(seedBank?.bank_name ?? '');
  const [accountNumber, setAccountNumber] = useState(seedBank?.account_number ?? '');
  const [country, setCountry] = useState(seedBank?.country ?? seedCard?.country ?? '');
  const [cardBrand, setCardBrand] = useState<CardBrandValue>(seedCard?.brand ?? 'visa');
  const [last4, setLast4] = useState(seedCard?.last4 ?? '');
  const [expiryMonth, setExpiryMonth] = useState(
    seedCard?.expiry_month ? String(seedCard.expiry_month) : '',
  );
  const [expiryYear, setExpiryYear] = useState(
    seedCard?.expiry_year ? String(seedCard.expiry_year) : '',
  );
  const [issuingBank, setIssuingBank] = useState(seedCard?.issuing_bank ?? '');
  const [makePreferred, setMakePreferred] = useState(false);
  // Errors stay quiet until the user has actually tried to save — a form that is
  // red before it is touched reads as broken.
  const [showErrors, setShowErrors] = useState(false);

  // Money going *out* never touches the payment gateway's operator enum, so every
  // wallet in the registry is selectable here — including the two that cannot yet
  // be charged. `payoutProvider` is the exact string a saved row already holds.
  const providerOptions = useMemo<PaymentOption[]>(
    () => brandOptions(MOBILE_MONEY_BRANDS, { valueOf: (b) => b.payoutProvider! }),
    [],
  );

  // Bank and card are documented and implemented end to end, but switched off
  // here for now: they stay listed and greyed rather than hidden, because a
  // missing option reads as "we don't do that" instead of "not yet". An entry
  // already saved as one still opens and edits — only picking it anew is barred.
  // One-word labels: three tiles abreast on a phone leave about eighty pixels of
  // text each, which "Virement bancaire" and a description underneath do not fit
  // — the fields below name the destination properly anyway.
  const methodOptions = useMemo<PaymentOption[]>(
    () => [
      {
        value: 'mobile_money',
        label: t('payout.mobileMoneyShort'),
        icon: Smartphone,
      },
      {
        value: 'bank',
        label: t('payout.bankShort'),
        icon: Building2,
        disabled: method !== 'bank',
        badge: t('payout.comingSoon'),
      },
      {
        value: 'card',
        label: t('payout.cardShort'),
        icon: CreditCard,
        disabled: method !== 'card',
        badge: t('payout.comingSoon'),
      },
    ],
    [t, method],
  );

  const currentYear = new Date().getFullYear();
  const expiryYears = useMemo(
    () => Array.from({ length: CARD_EXPIRY_YEARS }, (_, i) => currentYear + i),
    [currentYear],
  );

  // Built on every render against the same schema the save runs, so what this
  // dialog accepts and what the API accepts cannot drift.
  const draft: PayoutEntry =
    method === 'bank'
      ? {
          method: 'bank',
          bank: {
            bank_name: bankName.trim(),
            account_number: accountNumber.trim(),
            account_name: accountName.trim(),
            country,
          },
          mobile_money: null,
          card: null,
        }
      : method === 'card'
        ? {
            method: 'card',
            card: {
              brand: cardBrand,
              last4: last4.trim(),
              card_holder_name: accountName.trim(),
              expiry_month: Number(expiryMonth),
              expiry_year: Number(expiryYear),
              country,
              issuing_bank: issuingBank.trim() || null,
            },
            mobile_money: null,
            bank: null,
          }
        : {
            method: 'mobile_money',
            mobile_money: {
              provider,
              phone_number: phone.trim(),
              account_name: accountName.trim(),
            },
            bank: null,
            card: null,
          };

  const parsed = schema.safeParse(draft);
  const issues = showErrors && !parsed.success ? parsed.error.issues : [];
  const errorFor = (path: string) => issues.find((i) => i.path.join('.') === path)?.message;

  function handleSave() {
    if (!parsed.success) {
      setShowErrors(true);
      return;
    }
    // The parsed value, not the draft: zod trims and normalizes on the way
    // through, and that shape is what gets stored — and it carries no
    // `masked_detail`, so a re-entered secret replaces the mask for good.
    onSave(parsed.data, forcePreferred || makePreferred);
    onOpenChange(false);
  }

  const phoneError = errorFor('mobile_money.phone_number');
  // The API hands back `••••0000`, never the number, so an entry seeded from the
  // server starts blank here. Say why rather than looking like data was lost.
  const needsReentry = !!entry?.masked_detail;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={t(entry ? 'payout.editTitle' : 'payout.addTitle')}
      description={t(entry ? 'payout.editDescription' : 'payout.addDescription')}
      desktopClassName="sm:max-w-lg"
      // A short form — let the sheet size to it instead of standing at full height.
      mobileClassName="h-auto max-h-[92dvh]"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="max-sm:w-full"
          >
            {t('common:actions.cancel')}
          </Button>
          <Button type="button" onClick={handleSave} className="max-sm:w-full">
            {t('payout.saveMethod')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <PaymentOptionGroup
          label={t('payout.paymentMethod')}
          labelTone="section"
          // Tiles, not the description cards Billing uses: that dialog has two
          // options and this has three, and a third column is exactly what turns
          // a readable card into four wrapped lines on a phone.
          layout="tile"
          gridClassName="grid-cols-3"
          description={t('payout.comingSoonHint')}
          value={method}
          onValueChange={(value) => setMethod(value as PayoutMethodType)}
          options={methodOptions}
        />

        {method === 'mobile_money' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <PaymentOptionSelect
                id={`${fieldId}-provider`}
                label={t('payout.provider')}
                placeholder={t('payout.providerPlaceholder')}
                value={provider}
                onValueChange={setProvider}
                options={providerOptions}
                invalid={!!errorFor('mobile_money.provider')}
              />
              <FieldError message={errorFor('mobile_money.provider')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-phone`}>{t('payout.phoneNumber')}</Label>
              <PhoneInput
                id={`${fieldId}-phone`}
                value={phone}
                onChange={setPhone}
                required
                hasError={!!phoneError}
                describedBy={phoneError ? `${fieldId}-phone-error` : undefined}
              />
              {phoneError ? (
                <p id={`${fieldId}-phone-error`} className="text-xs text-destructive" role="alert">
                  {phoneError}
                </p>
              ) : (
                needsReentry && (
                  <p className="text-xs text-muted-foreground">{t('payout.reenterSecret')}</p>
                )
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-mm-name`}>{t('payout.accountName')}</Label>
              <Input
                id={`${fieldId}-mm-name`}
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                aria-invalid={!!errorFor('mobile_money.account_name')}
              />
              <FieldError message={errorFor('mobile_money.account_name')} />
            </div>
          </div>
        )}

        {method === 'bank' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-bank-name`}>{t('payout.bankName')}</Label>
              <Input
                id={`${fieldId}-bank-name`}
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                aria-invalid={!!errorFor('bank.bank_name')}
              />
              <FieldError message={errorFor('bank.bank_name')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-account-number`}>{t('payout.accountNumber')}</Label>
              <Input
                id={`${fieldId}-account-number`}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                aria-invalid={!!errorFor('bank.account_number')}
              />
              <FieldError message={errorFor('bank.account_number')} />
              {needsReentry && !errorFor('bank.account_number') && (
                <p className="text-xs text-muted-foreground">{t('payout.reenterSecret')}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-bank-account-name`}>{t('payout.accountName')}</Label>
              <Input
                id={`${fieldId}-bank-account-name`}
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                aria-invalid={!!errorFor('bank.account_name')}
              />
              <FieldError message={errorFor('bank.account_name')} />
            </div>
            <CountryField
              id={`${fieldId}-bank-country`}
              label={t('payout.bankCountry')}
              placeholder={t('payout.countryPlaceholder')}
              value={country}
              onChange={setCountry}
              options={countries}
              error={errorFor('bank.country')}
            />
          </div>
        )}

        {method === 'card' && (
          <div className="space-y-4">
            {/* Not a warning about our form — a statement about the API. It
                refuses a PAN or a CVV with a 400 rather than dropping them, so
                there is no field here that could take one. */}
            <p className="rounded-lg border border-dashed p-3 text-xs leading-snug text-muted-foreground">
              {t('payout.cardSecurityNote')}
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${fieldId}-card-brand`}>{t('payout.cardBrand')}</Label>
                <Select
                  value={cardBrand}
                  onValueChange={(value) => setCardBrand(value as CardBrandValue)}
                >
                  <SelectTrigger id={`${fieldId}-card-brand`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_BRANDS.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {cardBrandLabel(brand, t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={errorFor('card.brand')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${fieldId}-card-last4`}>{t('payout.cardLast4')}</Label>
                <Input
                  id={`${fieldId}-card-last4`}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  placeholder="1881"
                  value={last4}
                  onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  aria-invalid={!!errorFor('card.last4')}
                />
                <FieldError message={errorFor('card.last4')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-card-holder`}>{t('payout.cardHolder')}</Label>
              <Input
                id={`${fieldId}-card-holder`}
                placeholder={t('payout.cardHolderPlaceholder')}
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                aria-invalid={!!errorFor('card.card_holder_name')}
              />
              <FieldError message={errorFor('card.card_holder_name')} />
            </div>

            <div className="space-y-1.5">
              <Label id={`${fieldId}-expiry-label`}>{t('payout.cardExpiry')}</Label>
              {/* The pair is one field with two controls: the group carries
                  "Expiry", each select carries which half it is. */}
              <div
                role="group"
                aria-labelledby={`${fieldId}-expiry-label`}
                className="grid grid-cols-2 gap-2"
              >
                <Select value={expiryMonth} onValueChange={setExpiryMonth}>
                  <SelectTrigger aria-label={t('payout.cardExpiryMonth')} className="w-full">
                    <SelectValue placeholder={t('payout.cardExpiryMonth')} />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <SelectItem key={month} value={String(month)}>
                        {String(month).padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={expiryYear} onValueChange={setExpiryYear}>
                  <SelectTrigger aria-label={t('payout.cardExpiryYear')} className="w-full">
                    <SelectValue placeholder={t('payout.cardExpiryYear')} />
                  </SelectTrigger>
                  <SelectContent>
                    {expiryYears.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FieldError message={errorFor('card.expiry_month') ?? errorFor('card.expiry_year')} />
            </div>

            <CountryField
              id={`${fieldId}-card-country`}
              label={t('payout.cardCountry')}
              placeholder={t('payout.countryPlaceholder')}
              value={country}
              onChange={setCountry}
              options={countries}
              error={errorFor('card.country')}
            />

            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-issuing-bank`}>{t('payout.issuingBank')}</Label>
              <Input
                id={`${fieldId}-issuing-bank`}
                placeholder={t('payout.issuingBankPlaceholder')}
                value={issuingBank}
                onChange={(e) => setIssuingBank(e.target.value)}
                aria-invalid={!!errorFor('card.issuing_bank')}
              />
              <FieldError message={errorFor('card.issuing_bank')} />
            </div>
          </div>
        )}

        {!forcePreferred && (
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{t('payout.makePreferred')}</p>
              <p className="text-xs text-muted-foreground">{t('payout.makePreferredHint')}</p>
            </div>
            <Switch
              checked={makePreferred}
              onCheckedChange={setMakePreferred}
              aria-label={t('payout.makePreferred')}
            />
          </div>
        )}
      </div>
    </ResponsiveModal>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-destructive" role="alert">
      {message}
    </p>
  );
}

function CountryField({
  id,
  label,
  placeholder,
  value,
  onChange,
  options,
  error,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label id={`${id}-label`}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-labelledby={`${id}-label ${id}`} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError message={error} />
    </div>
  );
}
