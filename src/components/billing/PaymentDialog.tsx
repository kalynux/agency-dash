import { useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  Loader2,
  Smartphone,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Info,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { tx } from '@/i18n/tx';
import { PhoneInput } from '@/components/common/PhoneInput';
import { PaymentOptionGroup } from '@/components/common/PaymentOptionGroup';
import { PaymentOptionSelect } from '@/components/common/PaymentOptionSelect';
import { brandOptions, type PaymentOption } from '@/components/common/payment-options';
import { PaymentMethodMark } from '@/components/common/PaymentBrandLogo';
import { CARD_BRANDS, MOBILE_MONEY_BRANDS, resolveBrand } from '@/lib/payment-brands';
import { useDefaultPhoneCountry } from '@/hooks/useDefaultPhoneCountry';
import { phoneIssue, toSubmittablePhone } from '@/lib/phone';
import { phoneErrorMessage } from '@/lib/validation-schemas';
import type {
  PaymentChannel,
  PaymentGateway,
  PaymentInitResult,
  PaymentStatus,
  PhoneOperator,
} from '@/types/billing.types';
import type { SavedPaymentMethod } from '@/types/payment-method.types';
import { isStripeConfigured } from '@/lib/stripe';
import { fetchPaymentMethods } from '@/services/payment-methods.service';
import { StripePaymentElement, type StripePaymentElementHandle } from './StripePaymentElement';
import { CardPreview } from './CardPreview';
import { ProviderNote } from './ProviderNote';
import {
  GATEWAYS,
  CARD_GATEWAY,
  MOBILE_MONEY_GATEWAY,
  PAYMENT_POLL_INTERVAL_MS,
  PAYMENT_POLL_TIMEOUT_MS,
  billingErrorMessage,
  formatMoney,
  formatCharged,
  gatewayLabel,
  saveStripeResume,
  clearStripeResume,
  type StripeResumeKind,
} from './billing.constants';

type Phase = 'form' | 'card' | 'processing' | 'success' | 'failed' | 'timeout';

/** The top-level choice: a card Stripe collects, or a phone wallet. */
type Channel = 'card' | 'mobile_money';

/** Stripe init details carried from `form` into the `card` (Payment Element) phase. */
interface StripeInit {
  id: string;
  clientSecret: string;
  chargedAmount?: number;
  chargedCurrency?: string;
}

export interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Short line describing what's being bought, e.g. "Growth plan" or "5,000 credits". */
  summary: string;
  amount: number;
  currency: string;
  /** Which flow this is — drives the Stripe 3-D Secure resume marker. */
  paymentKind: StripeResumeKind;
  /** Initiate the gateway payment. Returns the normalised init result. */
  initiate: (gateway: PaymentGateway, channel: PaymentChannel) => Promise<PaymentInitResult>;
  /** Poll a pending payment; resolves with its current status. */
  verify: (id: string) => Promise<{ status: PaymentStatus }>;
  /** Called once the payment is confirmed paid (refresh balances/plan). */
  onPaid: () => void;
  successLabel?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The processors that collect a mobile-money charge. Which one runs it is a
 * back-office detail — it is offered, quietly, below the operator the agency
 * actually cares about, and only when there is more than one to pick from.
 */
const MOBILE_MONEY_GATEWAYS = GATEWAYS.filter((g) => g.methodType === 'mobile_money');

/** Map a saved method's provider to the gateway used to charge it. */
function providerToGateway(provider: string): PaymentGateway | null {
  switch (provider.toLowerCase()) {
    case 'stripe':
      return 'STRIPE';
    case 'notchpay':
      return 'NOTCHPAY';
    case 'mycoolpay':
      return 'MYCOOLPAY';
    default:
      return null;
  }
}

export function PaymentDialog({
  open,
  onOpenChange,
  title,
  summary,
  amount,
  currency,
  paymentKind,
  initiate,
  verify,
  onPaid,
  successLabel,
}: PaymentDialogProps) {
  const { t } = useTranslation(['billing', 'common']);
  const phoneCountry = useDefaultPhoneCountry();
  // Callers name what succeeded ("Plan purchased"); fall back to the generic line.
  const successText = successLabel ?? t('checkout.successTitle');

  // Mobile money leads: it is how most agencies here pay, and it is the only
  // channel that survives Stripe being unconfigured.
  const [channel, setChannel] = useState<Channel>('mobile_money');
  /** Which processor runs a mobile-money charge. Irrelevant on the card path. */
  const [mobileGateway, setMobileGateway] = useState<PaymentGateway>(MOBILE_MONEY_GATEWAY);
  const [phone, setPhone] = useState('');
  const [operator, setOperator] = useState<PhoneOperator>('MTN');
  const [holderName, setHolderName] = useState('');
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [instructionMsg, setInstructionMsg] = useState<string | null>(null);
  const [ussd, setUssd] = useState<string | null>(null);
  const [stripeInit, setStripeInit] = useState<StripeInit | null>(null);
  const [cardReady, setCardReady] = useState(false);

  // Saved methods power the quick-select chip row + autofill.
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);

  const cardRef = useRef<StripePaymentElementHandle>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDeadline = useRef<number>(0);

  const isStripe = channel === 'card';
  const gateway: PaymentGateway = isStripe ? CARD_GATEWAY : mobileGateway;

  const channelOptions = useMemo<PaymentOption[]>(() => {
    const cardMeta = GATEWAYS.find((g) => g.value === CARD_GATEWAY);
    const mobileMeta = GATEWAYS.find((g) => g.value === MOBILE_MONEY_GATEWAY);
    const options: PaymentOption[] = [
      {
        value: 'mobile_money',
        label: t('channels.mobileMoney.name'),
        description: t('channels.mobileMoney.description'),
        icon: Smartphone,
        meta: mobileMeta?.chargeCurrency,
      },
    ];
    // No publishable key means no card form to mount, so don't offer the choice.
    if (isStripeConfigured) {
      options.push({
        value: 'card',
        label: t('channels.card.name'),
        description: t('channels.card.description'),
        icon: CreditCard,
        meta: cardMeta?.chargeCurrency,
      });
    }
    return options;
  }, [t]);

  // Airtel and Wave are real operators, but the gateway has no enum member for
  // them yet — shown so the roster is honest, disabled so a charge can't be
  // started against something the API would reject.
  const operatorOptions = useMemo(
    () =>
      brandOptions(MOBILE_MONEY_BRANDS, {
        valueOf: (b) => b.operator ?? b.id,
        disabled: (b) => b.operator == null,
        badgeFor: (b) => (b.operator == null ? t('channels.comingSoon') : undefined),
      }),
    [t],
  );

  // Reset everything when the dialog is (re)opened or closed.
  useEffect(() => {
    if (open) {
      setChannel('mobile_money');
      setMobileGateway(MOBILE_MONEY_GATEWAY);
      setPhone('');
      setOperator('MTN');
      setHolderName('');
      setEmail('');
      setPhase('form');
      setSubmitting(false);
      setFormError(null);
      setCardError(null);
      setInstructionMsg(null);
      setUssd(null);
      setStripeInit(null);
      setCardReady(false);
      setSelectedSavedId(null);
    }
    return stopPolling;
  }, [open]);

  // Load saved methods for the quick-select row (best-effort — autofill only).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const methods = await fetchPaymentMethods();
        if (!cancelled) setSavedMethods(methods);
      } catch {
        if (!cancelled) setSavedMethods([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  function stopPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  function startPolling(id: string) {
    pollDeadline.current = Date.now() + PAYMENT_POLL_TIMEOUT_MS;
    stopPolling();
    pollTimer.current = setInterval(async () => {
      if (Date.now() > pollDeadline.current) {
        stopPolling();
        setPhase('timeout');
        return;
      }
      try {
        const { status } = await verify(id);
        if (status === 'paid') {
          stopPolling();
          setPhase('success');
          onPaid();
          toast.success(successText);
        } else if (status === 'failed' || status === 'reversed') {
          stopPolling();
          setPhase('failed');
        }
        // still pending → keep polling
      } catch {
        // transient verify error (e.g. not yet registered at gateway) — keep polling
      }
    }, PAYMENT_POLL_INTERVAL_MS);
  }

  /** Quick-select a saved method: switch channel + prefill what we can. */
  function selectSaved(method: SavedPaymentMethod) {
    setSelectedSavedId(method.id);
    setFormError(null);
    const gw = providerToGateway(method.provider);
    if (gw === 'STRIPE') {
      if (isStripeConfigured) setChannel('card');
    } else {
      setChannel('mobile_money');
      if (gw && MOBILE_MONEY_GATEWAYS.some((g) => g.value === gw)) setMobileGateway(gw);
    }
    if (method.holder_name) setHolderName(method.holder_name);
    if (method.method_type === 'mobile_money') {
      // A wallet saved for an operator we can't charge (Airtel, Wave) leaves the
      // current pick alone rather than silently paying through the wrong one.
      const op = resolveBrand(method.brand)?.operator;
      if (op) setOperator(op);
    }
  }

  function clearSaved() {
    setSelectedSavedId(null);
    setHolderName('');
    setPhone('');
  }

  /** Build the `channel` for the chosen gateway. Returns null + sets formError on bad input. */
  function buildChannel(): PaymentChannel | null {
    if (isStripe) {
      // Stripe collects the card client-side — send only identification fields.
      if (email.trim() && !EMAIL_RE.test(email.trim())) {
        setFormError(t('checkout.invalidEmail'));
        return null;
      }
      const channel: PaymentChannel = {};
      if (email.trim()) channel.customerEmail = email.trim();
      if (holderName.trim()) channel.customerName = holderName.trim();
      return channel;
    }
    // Mobile money — phone + operator are required. The number goes to the
    // gateway as E.164, validated for the country its picker names.
    const issue = phoneIssue(phone, { required: true, country: phoneCountry });
    if (issue) {
      setFormError(phoneErrorMessage(t, issue));
      return null;
    }
    return { phoneNumber: toSubmittablePhone(phone, phoneCountry), phoneOperator: operator };
  }

  /** Step 1: initiate the payment server-side. */
  async function handleInitiate() {
    setFormError(null);
    const channel = buildChannel();
    if (!channel) return;

    setSubmitting(true);
    try {
      const result = await initiate(gateway, channel);

      if (result.status === 'paid') {
        setPhase('success');
        onPaid();
        toast.success(successText);
        return;
      }
      if (result.status === 'failed' || result.status === 'reversed') {
        setPhase('failed');
        return;
      }

      // pending. For Stripe, mount the Payment Element and confirm the card next.
      if (isStripe && result.instructions?.clientSecret) {
        setStripeInit({
          id: result.id,
          clientSecret: result.instructions.clientSecret,
          chargedAmount: result.instructions.chargedAmount,
          chargedCurrency: result.instructions.chargedCurrency,
        });
        setCardError(null);
        setCardReady(false);
        setPhase('card');
        return;
      }

      // Mobile money (or a gateway that already confirmed): show instructions + poll.
      setUssd(result.instructions?.ussdCode ?? null);
      // The gateway's own instruction text arrives already localised for the
      // agency's country; ours is the fallback when it sends none.
      setInstructionMsg(result.instructions?.message ?? t('checkout.phonePrompt'));
      setPhase('processing');
      startPolling(result.id);
    } catch (err) {
      setFormError(billingErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  /** Step 2 (Stripe only): confirm the card via the Payment Element, then poll. */
  async function handleCardConfirm() {
    if (!stripeInit) return;
    setCardError(null);
    setSubmitting(true);

    // Persist a resume marker BEFORE confirming: if 3-D Secure forces a full-page
    // redirect, the verify-on-return picks the payment back up. (The webhook is the
    // authoritative finalizer regardless.)
    saveStripeResume(paymentKind, stripeInit.id);

    try {
      const returnUrl = window.location.href;
      const outcome = await cardRef.current!.confirm(returnUrl);

      if (outcome.status === 'redirecting') {
        // Stripe is navigating to the bank — leave the marker, the page will unload.
        setInstructionMsg(t('checkout.redirecting'));
        return;
      }

      // Confirmed in-page (succeeded / processing) — finalize via the verify poll.
      clearStripeResume();
      setInstructionMsg(
        outcome.status === 'succeeded' ? t('checkout.cardConfirmed') : t('checkout.confirming'),
      );
      setPhase('processing');
      startPolling(stripeInit.id);
    } catch (err) {
      clearStripeResume();
      setCardError(err instanceof Error ? err.message : t('checkout.cardFailed'));
      setSubmitting(false);
    }
  }

  function backToForm() {
    setStripeInit(null);
    setCardError(null);
    setCardReady(false);
    setSubmitting(false);
    setPhase('form');
  }

  function handleClose(next: boolean) {
    if (!next) stopPolling();
    onOpenChange(next);
  }

  const chargedLine =
    stripeInit?.chargedAmount != null
      ? formatCharged(stripeInit.chargedAmount, stripeInit.chargedCurrency)
      : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {/*
        Header and footer stay put and only the middle scrolls, so "Pay" is never
        pushed below the fold by a card form on a phone.
      */}
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 text-left sm:px-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {summary} ·{' '}
            <span className="font-medium text-foreground">{formatMoney(amount, currency)}</span>
          </DialogDescription>
        </DialogHeader>

        {phase === 'form' && (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              {/* Saved-method quick-select row */}
              {savedMethods.length > 0 && (
                <div className="space-y-2">
                  <Label asChild>
                    <p>{t('checkout.savedMethod')}</p>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {savedMethods.map((m) => (
                      <SavedChip
                        key={m.id}
                        method={m}
                        active={selectedSavedId === m.id}
                        onClick={() => selectSaved(m)}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={clearSaved}
                      aria-pressed={!selectedSavedId}
                      className={cn(
                        'flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        !selectedSavedId
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border text-muted-foreground [@media(hover:hover)]:hover:bg-accent/40',
                      )}
                    >
                      <Plus className="h-4 w-4" /> {t('checkout.newMethod')}
                    </button>
                  </div>
                </div>
              )}

              {channelOptions.length > 1 && (
                <PaymentOptionGroup
                  label={t('checkout.payWith')}
                  labelTone="section"
                  layout="stacked"
                  value={channel}
                  onValueChange={(v) => {
                    setChannel(v as Channel);
                    setFormError(null);
                  }}
                  options={channelOptions}
                />
              )}

              {!isStripe ? (
                <div className="space-y-4">
                  {/* A dropdown, not a grid of tiles: the operator is rarely the
                      thing being changed, and the amount to confirm is below. */}
                  <PaymentOptionSelect
                    id="pay-operator"
                    label={t('checkout.operator')}
                    placeholder={t('channels.operatorPlaceholder')}
                    note={t('channels.comingSoonHint')}
                    value={operator}
                    onValueChange={(v) => {
                      setOperator(v as PhoneOperator);
                      setFormError(null);
                    }}
                    options={operatorOptions}
                  />

                  <div className="space-y-1.5">
                    <Label htmlFor="pay-phone">{t('checkout.phone')}</Label>
                    <PhoneInput
                      id="pay-phone"
                      value={phone}
                      onChange={setPhone}
                      required
                      hasError={!!formError}
                    />
                  </div>

                  {/* Which processor runs the charge — a detail, so it sits last and small. */}
                  {MOBILE_MONEY_GATEWAYS.length > 1 && (
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-processor" className="text-xs text-muted-foreground">
                        {t('checkout.processedBy')}
                      </Label>
                      <Select
                        value={mobileGateway}
                        onValueChange={(v) => setMobileGateway(v as PaymentGateway)}
                      >
                        <SelectTrigger id="pay-processor">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MOBILE_MONEY_GATEWAYS.map((g) => (
                            <SelectItem key={g.value} value={g.value}>
                              {tx(t, g.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <ProviderNote
                    provider={gatewayLabel(CARD_GATEWAY)}
                    note={t('checkout.stripeNote')}
                    brands={CARD_BRANDS}
                  />

                  {/* Card payments are charged in USD — make that explicit up front. */}
                  <div className="flex gap-2 rounded-xl border border-info-500/30 bg-info-500/5 p-3 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-info-600" />
                    <span>
                      <Trans
                        ns="billing"
                        i18nKey="checkout.usdNotice"
                        components={{ strong: <span className="font-medium text-foreground" /> }}
                      />
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pay-name">{t('checkout.nameOnCard')}</Label>
                    <Input
                      id="pay-name"
                      placeholder={t('checkout.nameOnCardPlaceholder')}
                      value={holderName}
                      onChange={(e) => setHolderName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pay-email">{t('checkout.receiptEmail')}</Label>
                    <Input
                      id="pay-email"
                      type="email"
                      inputMode="email"
                      placeholder={t('checkout.receiptEmailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={!!formError}
                    />
                  </div>
                </div>
              )}

              {formError && (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              )}
            </div>

            <DialogFooter className="shrink-0 gap-2 border-t px-5 py-3 sm:px-6">
              <Button
                variant="outline"
                className="sm:min-w-24"
                onClick={() => handleClose(false)}
                disabled={submitting}
              >
                {t('common:actions.cancel')}
              </Button>
              <Button onClick={handleInitiate} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isStripe
                  ? t('checkout.continueToCard')
                  : t('checkout.confirmPayment', { amount: formatMoney(amount, currency) })}
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'card' && stripeInit && (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
              <CardPreview holderName={holderName} className="mx-auto max-w-sm" />

              {/* The exact USD charge from the server — never computed on the frontend. */}
              <div className="rounded-xl border bg-muted/30 p-3 text-center">
                {chargedLine ? (
                  <>
                    <p className="text-sm text-muted-foreground">{t('checkout.youWillBeCharged')}</p>
                    <p className="text-2xl font-bold">{chargedLine}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('checkout.chargedFor', {
                        summary,
                        amount: formatMoney(amount, currency),
                      })}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('checkout.completingFor', {
                      summary,
                      amount: formatMoney(amount, currency),
                    })}
                  </p>
                )}
              </div>

              <div className="flex gap-2 rounded-xl border border-info-500/30 bg-info-500/5 p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-info-600" />
                <span>{t('checkout.usdNoticeShort')}</span>
              </div>

              <div className="space-y-1.5">
                <Label>{t('checkout.cardDetails')}</Label>
                <StripePaymentElement
                  ref={cardRef}
                  clientSecret={stripeInit.clientSecret}
                  disabled={submitting}
                  onReady={() => setCardReady(true)}
                />
              </div>

              {cardError && (
                <p role="alert" className="text-sm text-destructive">
                  {cardError}
                </p>
              )}
            </div>

            <DialogFooter className="shrink-0 gap-2 border-t px-5 py-3 sm:px-6">
              <Button variant="outline" onClick={backToForm} disabled={submitting}>
                <ArrowLeft className="mr-1 h-4 w-4" /> {t('common:actions.back')}
              </Button>
              <Button onClick={handleCardConfirm} disabled={submitting || !cardReady}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {chargedLine ? t('checkout.pay', { amount: chargedLine }) : t('checkout.payNow')}
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'processing' && (
          <div className="space-y-4 px-5 py-6 text-center sm:px-6">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <div className="space-y-1">
              <p className="font-medium">{t('checkout.waiting')}</p>
              {instructionMsg && <p className="text-sm text-muted-foreground">{instructionMsg}</p>}
              {ussd && (
                <p className="text-sm">
                  <Trans
                    ns="billing"
                    i18nKey="checkout.dialUssd"
                    values={{ code: ussd }}
                    components={{ code: <span className="font-mono font-semibold" /> }}
                  />
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t('checkout.keepOpen')}</p>
            <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>
              {t('checkout.closeKeepProcessing')}
            </Button>
          </div>
        )}

        {phase === 'success' && (
          <ResultState
            icon={<CheckCircle2 className="mx-auto h-10 w-10 text-success" />}
            title={successText}
            description={t('checkout.successDescription')}
            action={<Button onClick={() => handleClose(false)}>{t('common:actions.done')}</Button>}
          />
        )}

        {phase === 'failed' && (
          <ResultState
            icon={<XCircle className="mx-auto h-10 w-10 text-destructive" />}
            title={t('checkout.failedTitle')}
            description={t('checkout.failedDescription')}
            action={
              <>
                <Button variant="outline" onClick={() => handleClose(false)}>
                  {t('common:actions.close')}
                </Button>
                <Button onClick={backToForm}>{t('common:actions.retry')}</Button>
              </>
            }
          />
        )}

        {phase === 'timeout' && (
          <ResultState
            icon={<Clock className="mx-auto h-10 w-10 text-warning" />}
            title={t('checkout.timeoutTitle')}
            description={t('checkout.timeoutDescription')}
            action={
              <>
                <Button variant="outline" onClick={() => handleClose(false)}>
                  {t('common:actions.close')}
                </Button>
                <Button onClick={backToForm}>{t('checkout.startOver')}</Button>
              </>
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SavedChip({
  method,
  active,
  onClick,
}: {
  method: SavedPaymentMethod;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-xl border px-2.5 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border text-muted-foreground [@media(hover:hover)]:hover:bg-accent/40',
      )}
      title={method.display_label}
    >
      <PaymentMethodMark brand={method.brand} methodType={method.method_type} size="sm" />
      <span className="max-w-[8rem] truncate">{method.display_label}</span>
    </button>
  );
}

function ResultState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="space-y-4 px-5 py-6 text-center sm:px-6">
      {icon}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex justify-center gap-2">{action}</div>
    </div>
  );
}
