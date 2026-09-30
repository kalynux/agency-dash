import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ResponsiveModal } from '@/components/common/ResponsiveModal';
import { PhoneInput } from '@/components/common/PhoneInput';
import { PaymentOptionSelect } from '@/components/common/PaymentOptionSelect';
import { brandOptions } from '@/components/common/payment-options';
import { useDefaultPhoneCountry } from '@/hooks/useDefaultPhoneCountry';
import { phoneIssue, toSubmittablePhone } from '@/lib/phone';
import { phoneErrorMessage } from '@/lib/validation-schemas';
import { getErrorCode } from '@/lib/errors';
import { MOBILE_MONEY_BRANDS, brandForOperator, brandLabel } from '@/lib/payment-brands';
import { ApiError } from '@/types/api';
import type { PhoneOperator, ProviderPhoneMismatchDetails } from '@/types/billing.types';
import type { AddPaymentMethodPayload, SavedPaymentMethod } from '@/types/payment-method.types';
import { addPaymentMethod } from '@/services/payment-methods.service';
import { billingErrorMessage } from './billing.constants';

/** The API's own bound on `label`. */
const LABEL_MAX_LENGTH = 100;

export interface AddPaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether the new method should be saved as default (true when wallet is empty). */
  forceDefault?: boolean;
  /** Already saved — the server does not refuse twins, so this dialog does. */
  existing: readonly SavedPaymentMethod[];
  onAdded: (method: SavedPaymentMethod) => void;
}

/**
 * The printed name of a network ("Orange Money", or "Orange" with `short`),
 * falling back to the code.
 */
function networkName(provider: string, short = false): string {
  const brand = brandForOperator(provider as PhoneOperator);
  if (!brand) return provider;
  return short ? brand.shortName : brandLabel(brand);
}

/**
 * Save a mobile-money wallet.
 *
 * Wallets only, since 2026-09-30: the API refuses a card, and describes a wallet
 * by the network the agency holds — `{ provider: 'MTN', phoneNumber }` — never
 * by the company that moves the money. See api-doc/agency/payment-methods.md.
 *
 * Every refusal keeps the sheet open with what was typed, because each one is
 * fixed by changing a field, not by starting again.
 */
export function AddPaymentMethodDialog({
  open,
  onOpenChange,
  forceDefault = false,
  existing,
  onAdded,
}: AddPaymentMethodDialogProps) {
  const { t } = useTranslation(['billing', 'common']);
  const phoneCountry = useDefaultPhoneCountry();

  const [phone, setPhone] = useState('');
  const [operator, setOperator] = useState<PhoneOperator>('MTN');
  const [label, setLabel] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** A form-wide refusal (limit, duplicate, anything unmapped). */
  const [error, setError] = useState<string | null>(null);
  /** Refusals that belong to one field, shown under it. */
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  /** The network the number's prefix belongs to, after a mismatch — offered as a one-tap switch. */
  const [detected, setDetected] = useState<PhoneOperator | null>(null);

  // Airtel and Wave are real operators we can pay *out* to, but the platform
  // has no provider for them — show them, don't let them be saved as something
  // that could never be charged.
  const operatorOptions = useMemo(
    () =>
      brandOptions(MOBILE_MONEY_BRANDS, {
        valueOf: (b) => b.operator ?? b.id,
        disabled: (b) => b.operator == null,
        badgeFor: (b) => (b.operator == null ? t('channels.comingSoon') : undefined),
      }),
    [t],
  );

  useEffect(() => {
    if (open) {
      setPhone('');
      setOperator('MTN');
      setLabel('');
      setMakeDefault(false);
      setSubmitting(false);
      setError(null);
      setPhoneError(null);
      setLabelError(null);
      setDetected(null);
    }
  }, [open]);

  function clearErrors() {
    setError(null);
    setPhoneError(null);
    setLabelError(null);
    setDetected(null);
  }

  /** Build the body, or set the field error and return null. Exactly the four documented keys. */
  function buildPayload(): AddPaymentMethodPayload | null {
    const issue = phoneIssue(phone, { required: true, country: phoneCountry });
    if (issue) {
      setPhoneError(phoneErrorMessage(t, issue));
      return null;
    }
    const phoneNumber = toSubmittablePhone(phone, phoneCountry);

    // No duplicate check server-side: saving the same number twice makes two
    // rows. `provider` + `last4` is what the list can compare on.
    const last4 = phoneNumber.slice(-4);
    if (existing.some((m) => m.provider === operator && m.last4 === last4)) {
      setError(t('methods.add.duplicate', { name: networkName(operator), last4 }));
      return null;
    }

    const payload: AddPaymentMethodPayload = { provider: operator, phoneNumber };
    // A blank label is refused — omit the key and the server writes one.
    const trimmed = label.trim();
    if (trimmed) payload.label = trimmed;
    // The first method is default whatever is sent, so the flag only matters after it.
    if (forceDefault || makeDefault) payload.isDefault = true;
    return payload;
  }

  function showSaveError(err: unknown) {
    switch (getErrorCode(err)) {
      case 'PAYMENT_PROVIDER_PHONE_MISMATCH': {
        // Nothing was written. Say which network the number is on and offer to
        // switch the picker to it, rather than silently flipping the choice.
        const details = (err as ApiError).details as Partial<ProviderPhoneMismatchDetails> | undefined;
        const found = details?.detected;
        if (found === 'MTN' || found === 'ORANGE' || found === 'MOOV') {
          setDetected(found);
          setPhoneError(
            t('methods.add.mismatch', {
              detected: networkName(found, true),
              provider: networkName(details?.provider ?? operator, true),
            }),
          );
          return;
        }
        setPhoneError(billingErrorMessage(err));
        return;
      }
      case 'VALIDATION_ERROR': {
        // The API names each failing field. Its text is the server's (English),
        // so a field we can phrase ourselves is phrased ourselves.
        const fields = err instanceof ApiError ? err.fieldErrors() : {};
        const phoneMsg = fields.phoneNumber;
        const labelMsg = fields.label;
        if (phoneMsg) setPhoneError(t('methods.add.phoneInvalid'));
        if (labelMsg) setLabelError(t('methods.add.labelInvalid', { max: LABEL_MAX_LENGTH }));
        if (!phoneMsg && !labelMsg) {
          setError(err instanceof ApiError ? (err.firstFieldError() ?? billingErrorMessage(err)) : billingErrorMessage(err));
        }
        return;
      }
      default:
        // `PAYMENT_METHOD_LIMIT_REACHED` has its own copy in `errors:codes`.
        setError(billingErrorMessage(err));
    }
  }

  async function handleSubmit() {
    clearErrors();
    const payload = buildPayload();
    if (!payload) return;
    setSubmitting(true);
    try {
      const created = await addPaymentMethod(payload);
      toast.success(t('methods.add.added'));
      onAdded(created);
      onOpenChange(false);
    } catch (err) {
      showSaveError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      disableClose={submitting}
      title={t('methods.add.title')}
      description={t('methods.add.description')}
      // The form is short — let the sheet size to it instead of standing at the
      // full height a phone-sized panel would otherwise take.
      mobileClassName="h-auto max-h-[92dvh]"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} className="sm:min-w-24">
            {t('common:actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="sm:min-w-36">
            {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t('methods.add.submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* A dropdown, not a grid of tiles: the operator is one field of three
            here, and the number below it is the one being typed. */}
        <PaymentOptionSelect
          id="add-operator"
          label={t('methods.add.operator')}
          placeholder={t('channels.operatorPlaceholder')}
          note={t('channels.comingSoonHint')}
          value={operator}
          onValueChange={(v) => {
            setOperator(v as PhoneOperator);
            clearErrors();
          }}
          options={operatorOptions}
        />

        <div className="space-y-1.5">
          <Label htmlFor="add-phone">{t('methods.add.phone')}</Label>
          <PhoneInput
            id="add-phone"
            value={phone}
            onChange={(v) => {
              setPhone(v);
              setPhoneError(null);
              setDetected(null);
            }}
            required
            hasError={!!phoneError}
          />
          {phoneError && (
            <div role="alert" className="space-y-2">
              <p className="text-sm text-destructive">{phoneError}</p>
              {detected && detected !== operator && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOperator(detected);
                    clearErrors();
                  }}
                >
                  {t('methods.add.switchTo', { name: networkName(detected) })}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="add-label">{t('methods.add.label')}</Label>
          <Input
            id="add-label"
            placeholder={t('methods.add.labelPlaceholder')}
            value={label}
            maxLength={LABEL_MAX_LENGTH}
            onChange={(e) => {
              setLabel(e.target.value);
              setLabelError(null);
            }}
            aria-invalid={!!labelError}
          />
          {labelError ? (
            <p role="alert" className="text-sm text-destructive">
              {labelError}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('methods.add.labelHint')}</p>
          )}
        </div>

        {!forceDefault && (
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-3 transition-colors [@media(hover:hover)]:hover:bg-accent/40">
            <span className="min-w-0">
              <span className="block text-sm font-medium">{t('methods.add.setAsDefault')}</span>
              <span className="block text-xs text-muted-foreground">
                {t('methods.add.setAsDefaultHint')}
              </span>
            </span>
            <Switch checked={makeDefault} onCheckedChange={setMakeDefault} />
          </label>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </ResponsiveModal>
  );
}
