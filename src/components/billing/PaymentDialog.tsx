import { useEffect, useRef, useState } from 'react';
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
import {
  PHONE_OPERATORS,
  GATEWAYS,
  PAYMENT_POLL_INTERVAL_MS,
  PAYMENT_POLL_TIMEOUT_MS,
  billingErrorMessage,
  formatMoney,
  formatCharged,
  saveStripeResume,
  clearStripeResume,
  type StripeResumeKind,
} from './billing.constants';

type Phase = 'form' | 'card' | 'processing' | 'success' | 'failed' | 'timeout';

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

const PHONE_RE = /^\+?\d{8,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Gateways selectable in the checkout (Stripe hidden when not configured). */
function availableGateways() {
  return GATEWAYS.filter((g) => g.methodType !== 'card' || isStripeConfigured);
}

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

/** Map a saved mobile-money brand to a known operator, if it matches. */
function brandToOperator(brand: string | null): PhoneOperator | null {
  const b = (brand ?? '').toUpperCase();
  if (b.includes('MTN')) return 'MTN';
  if (b.includes('ORANGE')) return 'ORANGE';
  if (b.includes('MOOV')) return 'MOOV';
  return null;
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
  successLabel = 'Payment confirmed',
}: PaymentDialogProps) {
  const gateways = availableGateways();

  const [gateway, setGateway] = useState<PaymentGateway>(gateways[0]?.value ?? 'NOTCHPAY');
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

  const methodType = gateways.find((g) => g.value === gateway)?.methodType ?? 'mobile_money';
  const isStripe = methodType === 'card';

  // Reset everything when the dialog is (re)opened or closed.
  useEffect(() => {
    if (open) {
      setGateway(gateways[0]?.value ?? 'NOTCHPAY');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          toast.success(successLabel);
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

  /** Quick-select a saved method: switch gateway + prefill what we can. */
  function selectSaved(method: SavedPaymentMethod) {
    setSelectedSavedId(method.id);
    setFormError(null);
    const gw = providerToGateway(method.provider);
    if (gw && gateways.some((g) => g.value === gw)) setGateway(gw);
    if (method.holder_name) setHolderName(method.holder_name);
    if (method.method_type === 'mobile_money') {
      const op = brandToOperator(method.brand);
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
        setFormError('Enter a valid email, or leave it blank.');
        return null;
      }
      const channel: PaymentChannel = {};
      if (email.trim()) channel.customerEmail = email.trim();
      if (holderName.trim()) channel.customerName = holderName.trim();
      return channel;
    }
    // Mobile money — phone + operator are required.
    if (!PHONE_RE.test(phone.trim())) {
      setFormError('Enter a valid phone number (e.g. +237650000000).');
      return null;
    }
    return { phoneNumber: phone.trim(), phoneOperator: operator };
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
        toast.success(successLabel);
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
      setInstructionMsg(
        result.instructions?.message ?? 'Confirm the payment prompt on your phone.',
      );
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
        setInstructionMsg('Redirecting you to your bank to confirm the payment…');
        return;
      }

      // Confirmed in-page (succeeded / processing) — finalize via the verify poll.
      clearStripeResume();
      setInstructionMsg(
        outcome.status === 'succeeded'
          ? 'Card confirmed — applying your purchase…'
          : 'Confirming your payment…',
      );
      setPhase('processing');
      startPolling(stripeInit.id);
    } catch (err) {
      clearStripeResume();
      setCardError(err instanceof Error ? err.message : 'The card payment failed. Please try again.');
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {summary} ·{' '}
            <span className="font-medium text-foreground">{formatMoney(amount, currency)}</span>
          </DialogDescription>
        </DialogHeader>

        {phase === 'form' && (
          <div className="space-y-4">
            {/* Saved-method quick-select row */}
            {savedMethods.length > 0 && (
              <div className="space-y-1.5">
                <Label>Payment method</Label>
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
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition',
                      !selectedSavedId
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <Plus className="h-4 w-4" /> New
                  </button>
                </div>
              </div>
            )}

            {/* Gateway-first selection */}
            <div className="space-y-1.5">
              <Label>Pay with</Label>
              <div className="grid grid-cols-3 gap-2">
                {gateways.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => {
                      setGateway(g.value);
                      setFormError(null);
                    }}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-2.5 text-xs font-medium transition',
                      gateway === g.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {g.methodType === 'card' ? (
                      <CreditCard className="h-4 w-4" />
                    ) : (
                      <Smartphone className="h-4 w-4" />
                    )}
                    {g.label}
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {g.chargeCurrency}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {methodType === 'mobile_money' ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pay-phone">Mobile money number</Label>
                  <Input
                    id="pay-phone"
                    inputMode="tel"
                    placeholder="+237650000000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    aria-invalid={!!formError}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-operator">Operator</Label>
                  <Select value={operator} onValueChange={(v) => setOperator(v as PhoneOperator)}>
                    <SelectTrigger id="pay-operator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PHONE_OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Card payments are charged in USD — make that explicit up front. */}
                <div className="flex gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <span>
                    Card payments are processed in <span className="font-medium text-foreground">USD</span>;
                    your bank may apply its own conversion. We'll show the exact dollar amount on the
                    next step.
                  </span>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-name">Name on card (optional)</Label>
                  <Input
                    id="pay-name"
                    placeholder="Agency name"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-email">Email for receipt (optional)</Label>
                  <Input
                    id="pay-email"
                    type="email"
                    inputMode="email"
                    placeholder="agency@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!formError}
                  />
                </div>
              </div>
            )}

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleInitiate} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isStripe ? 'Continue to card' : `Confirm Payment · ${formatMoney(amount, currency)}`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === 'card' && stripeInit && (
          <div className="space-y-4">
            <CardPreview holderName={holderName} />

            {/* The exact USD charge from the server — never computed on the frontend. */}
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              {chargedLine ? (
                <>
                  <p className="text-sm text-muted-foreground">You'll be charged</p>
                  <p className="text-2xl font-bold">{chargedLine}</p>
                  <p className="text-xs text-muted-foreground">
                    for {summary} ({formatMoney(amount, currency)})
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Completing payment for {summary} ({formatMoney(amount, currency)})
                </p>
              )}
            </div>

            <div className="flex gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <span>Charged in USD; your bank may apply its own currency conversion.</span>
            </div>

            <div className="space-y-1.5">
              <Label>Card details</Label>
              <StripePaymentElement
                ref={cardRef}
                clientSecret={stripeInit.clientSecret}
                disabled={submitting}
                onReady={() => setCardReady(true)}
              />
            </div>

            {cardError && <p className="text-sm text-destructive">{cardError}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={backToForm} disabled={submitting}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button onClick={handleCardConfirm} disabled={submitting || !cardReady}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {chargedLine ? `Pay ${chargedLine}` : 'Pay now'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === 'processing' && (
          <div className="space-y-4 py-2 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <div className="space-y-1">
              <p className="font-medium">Waiting for payment…</p>
              {instructionMsg && <p className="text-sm text-muted-foreground">{instructionMsg}</p>}
              {ussd && (
                <p className="text-sm">
                  Dial <span className="font-mono font-semibold">{ussd}</span> to approve.
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              This can take up to a couple of minutes. Keep this window open.
            </p>
            <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>
              Close (we'll keep processing)
            </Button>
          </div>
        )}

        {phase === 'success' && (
          <ResultState
            icon={<CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />}
            title={successLabel}
            description="Your account has been updated."
            action={<Button onClick={() => handleClose(false)}>Done</Button>}
          />
        )}

        {phase === 'failed' && (
          <ResultState
            icon={<XCircle className="mx-auto h-10 w-10 text-destructive" />}
            title="Payment failed"
            description="The payment was not completed. No charge was made — you can try again."
            action={
              <>
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Close
                </Button>
                <Button onClick={backToForm}>Try again</Button>
              </>
            }
          />
        )}

        {phase === 'timeout' && (
          <ResultState
            icon={<Clock className="mx-auto h-10 w-10 text-amber-500" />}
            title="Still processing"
            description="We couldn't confirm the payment in time. If you completed it, your balance will update shortly — check your history."
            action={
              <>
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Close
                </Button>
                <Button onClick={backToForm}>Start over</Button>
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
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition',
        active
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border text-muted-foreground hover:bg-muted',
      )}
      title={method.display_label}
    >
      {method.method_type === 'card' ? (
        <CreditCard className="h-4 w-4" />
      ) : (
        <Smartphone className="h-4 w-4" />
      )}
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
    <div className="space-y-4 py-2 text-center">
      {icon}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex justify-center gap-2">{action}</div>
    </div>
  );
}
