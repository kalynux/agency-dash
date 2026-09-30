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
  MessageSquareLock,
  ExternalLink,
  WifiOff,
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
import { cn } from '@/lib/utils';
import { PhoneInput } from '@/components/common/PhoneInput';
import { PaymentOptionGroup } from '@/components/common/PaymentOptionGroup';
import { PaymentOptionSelect } from '@/components/common/PaymentOptionSelect';
import { providerOptions, type PaymentOption } from '@/components/common/payment-options';
import { PaymentMethodMark } from '@/components/common/PaymentBrandLogo';
import { CARD_BRANDS } from '@/lib/payment-brands';
import { useDefaultPhoneCountry } from '@/hooks/useDefaultPhoneCountry';
import { usePaymentOptions } from '@/hooks/usePaymentOptions';
import { phoneIssue, toSubmittablePhone } from '@/lib/phone';
import { phoneErrorMessage } from '@/lib/validation-schemas';
import type {
  PaymentAuthorizeResult,
  PaymentChannel,
  PaymentInitResult,
  PaymentProvider,
  PaymentStatus,
  PhoneOperator,
  ProviderUnavailableDetails,
} from '@/types/billing.types';
import { methodTypeOf, type SavedPaymentMethod } from '@/types/payment-method.types';
import { ApiError } from '@/types/api';
import { getErrorCode } from '@/lib/errors';
import { cardPurchasesEnabled } from '@/platform/purchases';
import { fetchPaymentMethods } from '@/services/payment-methods.service';
import { StripePaymentElement, type StripePaymentElementHandle } from './StripePaymentElement';
import { CardPreview } from './CardPreview';
import { ProviderNote } from './ProviderNote';
import { ManageOnWebNotice } from './ManageOnWebNotice';
import {
  CHARGE_CURRENCY,
  PAYMENT_POLL_INTERVAL_MS,
  PAYMENT_POLL_TIMEOUT_MS,
  billingErrorMessage,
  formatMoney,
  formatCharged,
  saveStripeResume,
  clearStripeResume,
  type StripeResumeKind,
} from './billing.constants';

type Phase = 'form' | 'card' | 'otp' | 'processing' | 'success' | 'failed' | 'timeout';

/** The top-level choice: a card, or a phone wallet. */
type Channel = 'card' | 'mobile_money';

/** Card init details carried from `form` into the `card` (Payment Element) phase. */
interface StripeInit {
  id: string;
  clientSecret: string;
  /** From the `/options` `CARD` entry — never a build-time key. */
  publishableKey: string;
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
  /**
   * Initiate the payment with what the agency pays *with* — the aggregator is
   * the server's choice. Returns the normalised init result.
   */
  initiate: (provider: PaymentProvider, channel: PaymentChannel) => Promise<PaymentInitResult>;
  /** Poll a pending payment; resolves with its current status. */
  verify: (id: string) => Promise<{ status: PaymentStatus }>;
  /**
   * Relay the one-time SMS code, when the charge asks for one. Injected
   * like `initiate`/`verify` because the route differs per flow — a top-up and a
   * plan purchase authorise on their own owner-scoped endpoint.
   */
  authorize: (id: string, code: string) => Promise<PaymentAuthorizeResult>;
  /** Called once the payment is confirmed paid (refresh balances/plan). */
  onPaid: () => void;
  successLabel?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The one-time code's accepted length.
 *
 * The field is *sized* for six digits, which is what Orange Money texts, but the
 * API documents the range as 4–8 (api-doc/agency/billing.md § `authorize`).
 * Hard-requiring six would reject a valid shorter code and strand a payment the
 * operator is holding open, so six is the expectation, not the rule.
 */
const OTP_MIN_LENGTH = 4;
const OTP_MAX_LENGTH = 8;

/** `details.attemptsRemaining` off a `PAYMENT_OTP_INVALID`, when the API sent one. */
function attemptsRemaining(err: unknown): number | undefined {
  if (!(err instanceof ApiError)) return undefined;
  const details = err.details as { attemptsRemaining?: unknown } | undefined;
  return typeof details?.attemptsRemaining === 'number' ? details.attemptsRemaining : undefined;
}

/** `details.offered` off a `PAYMENT_PROVIDER_UNAVAILABLE`, when the API sent it. */
function offeredProviders(err: unknown): PaymentProvider[] | undefined {
  if (!(err instanceof ApiError)) return undefined;
  const details = err.details as Partial<ProviderUnavailableDetails> | undefined;
  return Array.isArray(details?.offered) ? details.offered : undefined;
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
  authorize,
  onPaid,
  successLabel,
}: PaymentDialogProps) {
  const { t } = useTranslation(['billing', 'common']);
  const phoneCountry = useDefaultPhoneCountry();
  // Callers name what succeeded ("Plan purchased"); fall back to the generic line.
  const successText = successLabel ?? t('checkout.successTitle');

  // What can be paid with right now, re-read on every opening. Nothing below
  // offers a choice this list does not contain.
  const paymentOptions = usePaymentOptions(open);
  const { applyOffered } = paymentOptions;
  const mobileOptions = useMemo(
    () => paymentOptions.providers.filter((o) => o.kind === 'MOBILE_MONEY'),
    [paymentOptions.providers],
  );
  const cardOption = useMemo(
    () => paymentOptions.providers.find((o) => o.kind === 'CARD'),
    [paymentOptions.providers],
  );
  // Two independent reasons not to offer a card here: the server lists none,
  // or this is the native shell, where 3-D Secure has no return_url to land on
  // (see platform/purchases).
  const cardOffered = !!cardOption && cardPurchasesEnabled;
  const optionsReady = paymentOptions.status === 'ready';
  /** Listed and payable from this build. `false` once loaded = online payment is off. */
  const canPay = mobileOptions.length > 0 || cardOffered;

  // Mobile money leads: it is how most agencies here pay.
  const [channel, setChannel] = useState<Channel>('mobile_money');
  const [phone, setPhone] = useState('');
  /** The mobile network, from `/options`. `null` until the list has loaded. */
  const [operator, setOperator] = useState<PhoneOperator | null>(null);
  /** A page to finish paying on, when the charge answered `redirectUrl`. */
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
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
  // The one-time-code step (`instructions.requiresOtp`). `otpPaymentId` is the id
  // the code is authorised against; it is held separately from the poll so a
  // failed authorise can be retried without re-initiating the payment.
  const [otpPaymentId, setOtpPaymentId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  /** Overrides the generic failure copy when we know exactly what went wrong. */
  const [failedReason, setFailedReason] = useState<string | null>(null);

  // Saved methods power the quick-select chip row + autofill.
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  /** The default wallet is pre-selected once per opening, not again after "New". */
  const autoPicked = useRef(false);

  /**
   * The saved methods that can pre-fill this payment: mobile-money wallets on a
   * network `/options` lists right now. An older card (`CARD`), a row whose
   * network is unknown (`null`), or a network switched off stays in the saved
   * list on the Billing page but is not offered here.
   */
  const payableSaved = useMemo(
    () =>
      savedMethods.filter(
        (m) => m.kind === 'MOBILE_MONEY' && mobileOptions.some((o) => o.provider === m.provider),
      ),
    [savedMethods, mobileOptions],
  );
  const selectedSaved = payableSaved.find((m) => m.id === selectedSavedId) ?? null;

  // Pre-select the default wallet when it is payable (api-doc/agency/
  // payment-methods.md § Pre-filling a payment). Only its network: the API never
  // returns the full number, so the agency types it — prompted by its last four.
  useEffect(() => {
    if (autoPicked.current || !optionsReady || !savedLoaded) return;
    autoPicked.current = true;
    const preferred = payableSaved.find((m) => m.isDefault);
    if (preferred) {
      setSelectedSavedId(preferred.id);
      setChannel('mobile_money');
      setOperator(preferred.provider as PhoneOperator);
    }
  }, [optionsReady, savedLoaded, payableSaved]);

  const cardRef = useRef<StripePaymentElementHandle>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDeadline = useRef<number>(0);

  const isCard = channel === 'card';
  const provider: PaymentProvider | null = isCard ? 'CARD' : operator;
  const selectedOption = paymentOptions.providers.find((o) => o.provider === provider);

  const channelOptions = useMemo<PaymentOption[]>(() => {
    const options: PaymentOption[] = [];
    if (mobileOptions.length > 0) {
      options.push({
        value: 'mobile_money',
        label: t('channels.mobileMoney.name'),
        description: t('channels.mobileMoney.description'),
        icon: Smartphone,
        meta: CHARGE_CURRENCY.MOBILE_MONEY,
      });
    }
    if (cardOffered) {
      options.push({
        value: 'card',
        label: t('channels.card.name'),
        description: t('channels.card.description'),
        icon: CreditCard,
        meta: CHARGE_CURRENCY.CARD,
      });
    }
    return options;
  }, [t, mobileOptions.length, cardOffered]);

  /**
   * Whether to say where cards went. Only when the platform is the reason — a
   * server that lists no card is not somewhere to send the agency, since the
   * web dashboard would not have a card form either.
   */
  const cardsLiveOnWeb = !cardPurchasesEnabled && !!cardOption;

  // Exactly the networks the server listed, in its order — no "Soon" entries:
  // a provider that is not listed cannot be paid with, whatever the reason.
  const operatorOptions = useMemo(
    () => providerOptions(mobileOptions.map((o) => o.provider as PhoneOperator)),
    [mobileOptions],
  );

  // Keep the selection inside what is offered, whenever the list (re)loads or
  // narrows after a refusal: a pick the server no longer lists moves to the
  // first one it does, and a channel with nothing left in it gives way.
  useEffect(() => {
    if (!optionsReady) return;
    if (channel === 'card' && !cardOffered && mobileOptions.length > 0) setChannel('mobile_money');
    if (channel === 'mobile_money' && mobileOptions.length === 0 && cardOffered) setChannel('card');
    if (!operator || !mobileOptions.some((o) => o.provider === operator)) {
      setOperator((mobileOptions[0]?.provider as PhoneOperator | undefined) ?? null);
    }
  }, [optionsReady, channel, cardOffered, mobileOptions, operator]);

  // Reset everything when the dialog is (re)opened or closed.
  useEffect(() => {
    if (open) {
      setChannel('mobile_money');
      setPhone('');
      setOperator(null);
      setRedirectUrl(null);
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
      setSavedLoaded(false);
      autoPicked.current = false;
      setOtpPaymentId(null);
      setOtpCode('');
      setOtpError(null);
      setFailedReason(null);
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
      if (!cancelled) setSavedLoaded(true);
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

  /** Quick-select a saved wallet: pick its network. Only ever called with a {@link payableSaved} entry. */
  function selectSaved(method: SavedPaymentMethod) {
    setSelectedSavedId(method.id);
    setFormError(null);
    setChannel('mobile_money');
    setOperator(method.provider as PhoneOperator);
  }

  function clearSaved() {
    setSelectedSavedId(null);
    setHolderName('');
    setPhone('');
  }

  /** Build the `channel` for the chosen provider. Returns null + sets formError on bad input. */
  function buildChannel(): PaymentChannel | null {
    if (isCard) {
      // The card is collected client-side — send only identification fields.
      if (email.trim() && !EMAIL_RE.test(email.trim())) {
        setFormError(t('checkout.invalidEmail'));
        return null;
      }
      const channel: PaymentChannel = {};
      if (email.trim()) channel.customerEmail = email.trim();
      if (holderName.trim()) channel.customerName = holderName.trim();
      return channel;
    }
    // Mobile money — the fields `/options` listed, which for a phone wallet is
    // the number, sent as E.164 and validated for the country its picker names.
    // No `phoneOperator`: the provider *is* the network.
    const channel: PaymentChannel = {};
    if (selectedOption?.fields.includes('phoneNumber') ?? true) {
      const issue = phoneIssue(phone, { required: true, country: phoneCountry });
      if (issue) {
        setFormError(phoneErrorMessage(t, issue));
        return null;
      }
      channel.phoneNumber = toSubmittablePhone(phone, phoneCountry);
    }
    return channel;
  }

  /** Step 1: initiate the payment server-side. */
  async function handleInitiate() {
    setFormError(null);
    if (!provider) return;
    const channel = buildChannel();
    if (!channel) return;

    setSubmitting(true);
    try {
      const result = await initiate(provider, channel);

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

      // pending. What happens next is read off what `instructions` contains —
      // never off which channel was picked, nor which aggregator answered.

      // A client secret: mount the Payment Element and confirm the card next.
      if (result.instructions?.clientSecret) {
        const publishableKey = cardOption?.publishableKey;
        if (!publishableKey) {
          // Cards were switched off between loading the list and this answer;
          // there is no key to mount a form with, so nothing can be confirmed.
          setFormError(t('card.unavailable'));
          return;
        }
        setStripeInit({
          id: result.id,
          clientSecret: result.instructions.clientSecret,
          publishableKey,
          chargedAmount: result.instructions.chargedAmount,
          chargedCurrency: result.instructions.chargedCurrency,
        });
        setCardError(null);
        setCardReady(false);
        setPhase('card');
        return;
      }

      // The operator texted a one-time code instead of raising a prompt. Nothing
      // moves until that code is relayed, so polling here would just run out the
      // clock while the payer waits for a prompt that is never coming. Honoured
      // even when `/options` said `PUSH`: the aggregator may have been switched
      // between the two calls, and the charge follows the one active now.
      if (result.instructions?.requiresOtp) {
        setOtpPaymentId(result.id);
        setOtpCode('');
        setOtpError(null);
        // `instructions.message` is deliberately not shown on this step. On this
        // one branch the adapter hardcodes an English sentence that says exactly
        // what our own copy says, minus the number it was sent to — so it would
        // read as a duplicate, in the wrong language, on a French UI.
        setPhase('otp');
        return;
      }

      // A page to finish on. Offered as a link rather than opened for them: a
      // window opened after an `await` is what popup blockers stop. Polling
      // starts now, so coming back to this tab picks the result straight up.
      if (result.instructions?.redirectUrl) {
        setRedirectUrl(result.instructions.redirectUrl);
        setUssd(null);
        setInstructionMsg(t('checkout.redirectPrompt'));
        setPhase('processing');
        startPolling(result.id);
        return;
      }

      // A prompt on the handset (or already confirmed): show instructions + poll.
      setUssd(result.instructions?.ussdCode ?? null);
      // The provider's own instruction text arrives already localised for the
      // agency's country; ours is the fallback when it sends none.
      setInstructionMsg(result.instructions?.message ?? t('checkout.phonePrompt'));
      setPhase('processing');
      startPolling(result.id);
    } catch (err) {
      // Both refusals below are raised before anything is written, so the form
      // stays exactly as typed and a corrected retry is safe.
      const offered =
        getErrorCode(err) === 'PAYMENT_PROVIDER_UNAVAILABLE' ? offeredProviders(err) : undefined;
      if (offered) {
        // Switched off after the dialog loaded: re-render from the fresh list.
        // Empty means online payment is now off, and the form says so itself.
        applyOffered(offered);
        setFormError(offered.length > 0 ? t('checkout.providerSwitchedOff') : null);
      } else {
        // `PAYMENT_PROVIDER_PHONE_MISMATCH` names the number's own network from
        // `details.detected` (lib/errors), so the agency can switch or retype.
        setFormError(billingErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Step 2 (mobile money, OTP branch): relay the code, then poll as usual.
   *
   * A successful authorise leaves the payment `pending`, and that is correct —
   * the code only releases the operator's prompt, the payer still confirms it on
   * the handset, and the webhook or the verify poll settles it. A 200 here is
   * explicitly not "paid". The instructions are re-read because the USSD code for
   * that second step arrives in *this* response; `initiate` had none.
   */
  async function handleAuthorize() {
    if (!otpPaymentId) return;
    const code = otpCode.trim();
    if (code.length < OTP_MIN_LENGTH) {
      setOtpError(t('checkout.otpTooShort', { count: OTP_MIN_LENGTH }));
      return;
    }

    setOtpError(null);
    setSubmitting(true);
    try {
      const { status, instructions } = await authorize(otpPaymentId, code);

      // Not expected — the row is `pending` on this path — but a settled row must
      // never be shown as still waiting, so the status is read rather than assumed.
      if (status === 'paid') {
        setPhase('success');
        onPaid();
        toast.success(successText);
        return;
      }
      if (status === 'failed' || status === 'reversed') {
        setPhase('failed');
        return;
      }

      setUssd(instructions?.ussdCode ?? null);
      setInstructionMsg(instructions?.message ?? t('checkout.phonePrompt'));
      setPhase('processing');
      startPolling(otpPaymentId);
    } catch (err) {
      switch (getErrorCode(err)) {
        case 'PAYMENT_OTP_ATTEMPTS_EXCEEDED':
          // Terminal: the backend has already written the payment FAILED. Retrying
          // the code is impossible, so the only honest offer is a fresh payment.
          setFailedReason(t('checkout.otpAttemptsExceeded'));
          setPhase('failed');
          break;
        case 'PAYMENT_OTP_NOT_REQUIRED':
        case 'BILLING_TOPUP_INVALID_STATE':
        case 'BILLING_PURCHASE_INVALID_STATE': {
          // Either this payment never wanted a code, or it has already settled —
          // a paid row refuses a second code, because accepting one would be a
          // second charge. Both make the field useless, and only the poll can say
          // which, so stop asking and go find out.
          setInstructionMsg(billingErrorMessage(err));
          setUssd(null);
          setPhase('processing');
          startPolling(otpPaymentId);
          break;
        }
        case 'PAYMENT_OTP_INVALID': {
          const left = attemptsRemaining(err);
          // `left === 0` is reachable and is not the same as "try again": the
          // counter is spent, so the next submit fails the payment outright
          // rather than checking the code. Say so instead of inviting a retry.
          setOtpError(
            left === undefined
              ? billingErrorMessage(err)
              : left <= 0
                ? t('checkout.otpNoTriesLeft')
                : t('checkout.otpInvalid', { count: left }),
          );
          setOtpCode('');
          break;
        }
        default:
          setOtpError(billingErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  /** Step 2 (card only): confirm the card via the Payment Element, then poll. */
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
    setRedirectUrl(null);
    setCardError(null);
    setCardReady(false);
    setSubmitting(false);
    setOtpPaymentId(null);
    setOtpCode('');
    setOtpError(null);
    setFailedReason(null);
    setUssd(null);
    setInstructionMsg(null);
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
        <DialogHeader className="shrink-0 border-b px-5 py-4 pe-12 text-start sm:px-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {summary} ·{' '}
            <span className="font-medium text-foreground">{formatMoney(amount, currency)}</span>
          </DialogDescription>
        </DialogHeader>

        {phase === 'form' && (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              {/* Saved-method quick-select row — only beside a form it can fill. */}
              {optionsReady && canPay && payableSaved.length > 0 && (
                <div className="space-y-2">
                  <Label asChild>
                    <p>{t('checkout.savedMethod')}</p>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {payableSaved.map((m) => (
                      <SavedChip
                        key={m.id}
                        method={m}
                        active={selectedSaved?.id === m.id}
                        onClick={() => selectSaved(m)}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={clearSaved}
                      aria-pressed={!selectedSaved}
                      className={cn(
                        'flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        !selectedSaved
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border text-muted-foreground [@media(hover:hover)]:hover:bg-accent/40',
                      )}
                    >
                      <Plus className="h-4 w-4" /> {t('checkout.newMethod')}
                    </button>
                  </div>
                </div>
              )}

              {paymentOptions.status === 'loading' && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('checkout.loadingOptions')}
                </div>
              )}

              {paymentOptions.status === 'error' && (
                <div className="space-y-3 rounded-xl border p-4 text-center" role="alert">
                  <p className="text-sm text-muted-foreground">{t('checkout.optionsLoadFailed')}</p>
                  <Button variant="outline" size="sm" onClick={paymentOptions.reload}>
                    {t('common:actions.retry')}
                  </Button>
                </div>
              )}

              {/* An administrator switched online payment off. A valid answer,
                  not a fault — so no retry, and no pay button below. */}
              {optionsReady && !canPay && (
                <div className="flex gap-3 rounded-xl border bg-muted/40 p-4">
                  <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{t('checkout.unavailableTitle')}</p>
                    <p className="text-sm text-muted-foreground">{t('checkout.unavailableDescription')}</p>
                  </div>
                </div>
              )}

              {optionsReady && canPay && channelOptions.length > 1 && (
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

              {optionsReady && canPay && !isCard && (
                <div className="space-y-4">
                  {/* A dropdown, not a grid of tiles: the operator is rarely the
                      thing being changed, and the amount to confirm is below. */}
                  <PaymentOptionSelect
                    id="pay-operator"
                    label={t('checkout.operator')}
                    placeholder={t('channels.operatorPlaceholder')}
                    value={operator ?? undefined}
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
                    {/* A saved wallet can't fill the number in (the API returns
                        it masked), so say which one it was. */}
                    {selectedSaved?.last4 && !phone && (
                      <p className="text-xs text-muted-foreground">
                        {t('checkout.savedNumberHint', { last4: selectedSaved.last4 })}
                      </p>
                    )}
                    {/* Said up front, so a text message arriving instead of a
                        prompt is expected. The initiate answer still decides. */}
                    {selectedOption?.mayRequireOtp && (
                      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MessageSquareLock className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {t('checkout.mayRequireOtp')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {optionsReady && canPay && isCard && (
                <div className="space-y-4">
                  <ProviderNote
                    title={t('checkout.cardSecureTitle')}
                    note={t('checkout.cardSecureNote')}
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

              {/* Where the card option went, on a build that cannot land a 3-D
                  Secure redirect. Below the form, not above it: mobile money
                  works here, so this is a footnote and not the headline. */}
              {cardsLiveOnWeb && <ManageOnWebNotice kind="payCard" />}

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
              {/* No pay button while nothing can be paid with — loading, failed
                  to load, or switched off. */}
              {optionsReady && canPay && (
                <Button onClick={handleInitiate} disabled={submitting || !provider}>
                  {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {isCard
                    ? t('checkout.continueToCard')
                    : t('checkout.confirmPayment', { amount: formatMoney(amount, currency) })}
                </Button>
              )}
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
                  publishableKey={stripeInit.publishableKey}
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
                <ArrowLeft className="me-1 h-4 w-4" /> {t('common:actions.back')}
              </Button>
              <Button onClick={handleCardConfirm} disabled={submitting || !cardReady}>
                {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {chargedLine ? t('checkout.pay', { amount: chargedLine }) : t('checkout.payNow')}
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'otp' && (
          <>
            {/*
              Same scroll shape as the form and card phases: the body scrolls and
              the footer is pinned inside the dialog. The dialog itself is capped
              in `dvh`, and on Android the IME inset shrinks the WebView viewport,
              so "Confirm code" stays above the keyboard without any of the
              `useKeyboardOpen()` handling the app's `fixed bottom-0` bars need —
              a DialogFooter is not a fixed bar.
            */}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="space-y-2 text-center">
                <MessageSquareLock className="mx-auto h-9 w-9 text-primary" aria-hidden="true" />
                <p className="font-medium">{t('checkout.otpTitle')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('checkout.otpPrompt', { phone })}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-otp">{t('checkout.otpLabel')}</Label>
                <Input
                  id="pay-otp"
                  // `one-time-code` is what lets Android offer the SMS straight
                  // from the keyboard bar; `numeric` keeps it off the QWERTY layout.
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  autoFocus
                  maxLength={OTP_MAX_LENGTH}
                  value={otpCode}
                  onChange={(e) => {
                    setOtpCode(e.target.value.replace(/\D/g, '').slice(0, OTP_MAX_LENGTH));
                    setOtpError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !submitting) void handleAuthorize();
                  }}
                  aria-invalid={!!otpError}
                  aria-describedby="pay-otp-help"
                  className="text-center font-mono text-2xl tracking-[0.4em]"
                  placeholder="——————"
                />
                <p id="pay-otp-help" className="text-xs text-muted-foreground">
                  {t('checkout.otpHelp')}
                </p>
              </div>

              {otpError && (
                <p role="alert" className="text-sm text-destructive">
                  {otpError}
                </p>
              )}
            </div>

            <DialogFooter className="shrink-0 gap-2 border-t px-5 py-3 sm:px-6">
              <Button variant="outline" onClick={backToForm} disabled={submitting}>
                <ArrowLeft className="me-1 h-4 w-4" /> {t('common:actions.back')}
              </Button>
              <Button
                onClick={handleAuthorize}
                disabled={submitting || otpCode.length < OTP_MIN_LENGTH}
              >
                {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t('checkout.otpSubmit')}
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
              {redirectUrl && (
                <Button asChild size="sm" className="mt-2">
                  <a href={redirectUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="me-1.5 h-4 w-4" aria-hidden="true" />
                    {t('checkout.openPaymentPage')}
                  </a>
                </Button>
              )}
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
            description={failedReason ?? t('checkout.failedDescription')}
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
      title={method.label}
    >
      <PaymentMethodMark brand={method.provider} methodType={methodTypeOf(method.kind)} size="sm" />
      <span className="max-w-[8rem] truncate">{method.label}</span>
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
