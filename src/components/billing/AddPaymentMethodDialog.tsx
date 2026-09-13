import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Smartphone, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ResponsiveModal } from '@/components/common/ResponsiveModal';
import { PhoneInput } from '@/components/common/PhoneInput';
import { PaymentOptionGroup } from '@/components/common/PaymentOptionGroup';
import { PaymentOptionSelect } from '@/components/common/PaymentOptionSelect';
import { brandOptions, type PaymentOption } from '@/components/common/payment-options';
import { useDefaultPhoneCountry } from '@/hooks/useDefaultPhoneCountry';
import { phoneIssue, toSubmittablePhone } from '@/lib/phone';
import { phoneErrorMessage } from '@/lib/validation-schemas';
import { MOBILE_MONEY_BRANDS } from '@/lib/payment-brands';
import type { PhoneOperator } from '@/types/billing.types';
import type { AddPaymentMethodPayload, SavedPaymentMethod } from '@/types/payment-method.types';
import { isStripeConfigured } from '@/lib/stripe';
import { cardPurchasesEnabled } from '@/platform/purchases';
import { addPaymentMethod } from '@/services/payment-methods.service';
import { StripeCardField, type StripeCardFieldHandle } from './StripeCardField';
import { CardPreview } from './CardPreview';
import { GatewayBadge } from './ProviderNote';
import { ManageOnWebNotice } from './ManageOnWebNotice';
import { CARD_GATEWAY, MOBILE_MONEY_GATEWAY, billingErrorMessage } from './billing.constants';

/** The top-level choice: a card Stripe tokenises, or a phone wallet. */
type Channel = 'card' | 'mobile_money';

export interface AddPaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether the new method should be saved as default (true when wallet is empty). */
  forceDefault?: boolean;
  onAdded: (method: SavedPaymentMethod) => void;
}

export function AddPaymentMethodDialog({
  open,
  onOpenChange,
  forceDefault = false,
  onAdded,
}: AddPaymentMethodDialogProps) {
  const { t } = useTranslation(['billing', 'common']);
  const phoneCountry = useDefaultPhoneCountry();

  // Mobile money leads: it is how most agencies here actually pay, and it is the
  // only channel that survives Stripe being unconfigured.
  const [channel, setChannel] = useState<Channel>('mobile_money');
  const [phone, setPhone] = useState('');
  const [operator, setOperator] = useState<PhoneOperator>('MTN');
  const [holderName, setHolderName] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardRef = useRef<StripeCardFieldHandle>(null);

  const channelOptions = useMemo<PaymentOption[]>(() => {
    const options: PaymentOption[] = [
      {
        value: 'mobile_money',
        label: t('channels.mobileMoney.name'),
        description: t('channels.mobileMoney.description'),
        icon: Smartphone,
        // Saving a wallet always tokenises through the one processor that can
        // debit it — so it is stated here rather than taking up a field the
        // agency cannot change.
        footer: <GatewayBadge gateway={MOBILE_MONEY_GATEWAY} />,
      },
    ];
    // No publishable key means no card form to mount; `!cardPurchasesEnabled`
    // means a card saved here could never be charged from this build anyway
    // (3-D Secure has nowhere to return to — see platform/purchases).
    if (isStripeConfigured && cardPurchasesEnabled) {
      options.push({
        value: 'card',
        label: t('channels.card.name'),
        description: t('channels.card.description'),
        icon: CreditCard,
      });
    }
    return options;
  }, [t]);

  /** Say where cards are saved instead — only when the platform is the reason. */
  const cardsLiveOnWeb = !cardPurchasesEnabled && isStripeConfigured;

  // Airtel and Wave are real operators we can pay *out* to, but the payments
  // gateway has no enum member for them yet — show them, don't let them be
  // saved as something we could never charge.
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
      setChannel('mobile_money');
      setPhone('');
      setOperator('MTN');
      setHolderName('');
      setMakeDefault(false);
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  async function buildPayload(): Promise<AddPaymentMethodPayload> {
    const isDefault = forceDefault || makeDefault;

    if (channel === 'card') {
      // Stripe gives us a reusable PaymentMethod (instrument) + card metadata.
      const card = await cardRef.current!.createPaymentMethod(holderName.trim() || undefined);
      const brand = card.brand;
      const last4 = card.last4;
      const label = `${(brand ?? 'CARD').toUpperCase()} •••• ${last4 ?? '••••'}`;
      return {
        provider: CARD_GATEWAY.toLowerCase(),
        // No customer id is available client-side with a publishable key; the backend
        // resolves/creates it. We send the instrument id as a non-empty placeholder to
        // satisfy the contract (best-effort id mapping).
        gateway_customer_id: card.instrumentId,
        gateway_instrument_id: card.instrumentId,
        method_type: 'card',
        display_label: label,
        brand: brand,
        last4: last4,
        exp_month: card.expMonth,
        exp_year: card.expYear,
        holder_name: holderName.trim() || null,
        is_default: isDefault,
      };
    }

    // Mobile money — no client SDK to tokenise; store display metadata + provider.
    // The phone reference stands in for the gateway token ids until real tokenisation
    // is wired (charging a saved method is a future backend step per the docs).
    const issue = phoneIssue(phone, { required: true, country: phoneCountry });
    if (issue) throw new Error(phoneErrorMessage(t, issue));
    // E.164 is what the reference is keyed on, so the same wallet saved from two
    // screens produces the same id.
    const e164 = toSubmittablePhone(phone, phoneCountry);
    const provider = MOBILE_MONEY_GATEWAY.toLowerCase();
    const last4 = e164.slice(-4);
    const ref = `${provider}:${e164}`;
    return {
      provider,
      gateway_customer_id: ref,
      gateway_instrument_id: ref,
      method_type: 'mobile_money',
      display_label: `${operator} •••• ${last4}`,
      brand: operator,
      last4,
      holder_name: holderName.trim() || null,
      is_default: isDefault,
    };
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const payload = await buildPayload();
      const created = await addPaymentMethod(payload);
      toast.success(t('methods.add.added'));
      onAdded(created);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? billingErrorMessage(err, err.message) : billingErrorMessage(err));
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
        {channelOptions.length > 1 && (
          <PaymentOptionGroup
            label={t('methods.add.channel')}
            labelTone="section"
            layout="stacked"
            value={channel}
            onValueChange={(v) => {
              setChannel(v as Channel);
              setError(null);
            }}
            options={channelOptions}
          />
        )}

        {channel === 'mobile_money' ? (
          <section className="space-y-4">
            {/* A dropdown, not a grid of tiles: the operator is one field of
                three here, and the number below it is the one being typed. */}
            <PaymentOptionSelect
              id="add-operator"
              label={t('methods.add.operator')}
              placeholder={t('channels.operatorPlaceholder')}
              note={t('channels.comingSoonHint')}
              value={operator}
              onValueChange={(v) => {
                setOperator(v as PhoneOperator);
                setError(null);
              }}
              options={operatorOptions}
            />

            <div className="space-y-1.5">
              <Label htmlFor="add-phone">{t('methods.add.phone')}</Label>
              <PhoneInput id="add-phone" value={phone} onChange={setPhone} required hasError={!!error} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-holder-mm">{t('methods.add.holderNameMobile')}</Label>
              <Input
                id="add-holder-mm"
                placeholder={t('methods.add.holderNameMobilePlaceholder')}
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
              />
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            {/* No provider note above the preview: the card that opened this
                branch already says who secures it, and the reassurance reads as
                boilerplate the second time. */}
            <CardPreview holderName={holderName} className="mx-auto max-w-sm" />

            <div className="space-y-1.5">
              <Label htmlFor="add-holder">{t('methods.add.holderNameCard')}</Label>
              <Input
                id="add-holder"
                placeholder={t('methods.add.holderNameCardPlaceholder')}
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('methods.add.cardDetails')}</Label>
              <StripeCardField ref={cardRef} disabled={submitting} />
            </div>
          </section>
        )}

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

        {/* Where the card option went. Last, and quiet: saving a mobile-money
            number is the thing this sheet is for on a phone. */}
        {cardsLiveOnWeb && <ManageOnWebNotice kind="saveCard" />}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </ResponsiveModal>
  );
}
