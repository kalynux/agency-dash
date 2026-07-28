import { useEffect, useRef, useState } from 'react';
import { Loader2, Smartphone, CreditCard } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { PaymentGateway, PhoneOperator } from '@/types/billing.types';
import type { AddPaymentMethodPayload, SavedPaymentMethod } from '@/types/payment-method.types';
import { isStripeConfigured } from '@/lib/stripe';
import { addPaymentMethod } from '@/services/payment-methods.service';
import { StripeCardField, type StripeCardFieldHandle } from './StripeCardField';
import { CardPreview } from './CardPreview';
import { PHONE_OPERATORS, GATEWAYS, billingErrorMessage } from './billing.constants';

export interface AddPaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether the new method should be saved as default (true when wallet is empty). */
  forceDefault?: boolean;
  onAdded: (method: SavedPaymentMethod) => void;
}

const PHONE_RE = /^\+?\d{8,15}$/;

function gatewayOptions() {
  return GATEWAYS.filter((g) => g.methodType !== 'card' || isStripeConfigured);
}

export function AddPaymentMethodDialog({
  open,
  onOpenChange,
  forceDefault = false,
  onAdded,
}: AddPaymentMethodDialogProps) {
  const gateways = gatewayOptions();

  const [gateway, setGateway] = useState<PaymentGateway>(gateways[0]?.value ?? 'NOTCHPAY');
  const [phone, setPhone] = useState('');
  const [operator, setOperator] = useState<PhoneOperator>('MTN');
  const [holderName, setHolderName] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardRef = useRef<StripeCardFieldHandle>(null);
  const methodType = gateways.find((g) => g.value === gateway)?.methodType ?? 'mobile_money';

  useEffect(() => {
    if (open) {
      setGateway(gateways[0]?.value ?? 'NOTCHPAY');
      setPhone('');
      setOperator('MTN');
      setHolderName('');
      setMakeDefault(false);
      setSubmitting(false);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function buildPayload(): Promise<AddPaymentMethodPayload> {
    const isDefault = forceDefault || makeDefault;

    if (methodType === 'card') {
      // Stripe gives us a reusable PaymentMethod (instrument) + card metadata.
      const card = await cardRef.current!.createPaymentMethod(holderName.trim() || undefined);
      const brand = card.brand;
      const last4 = card.last4;
      const label = `${(brand ?? 'CARD').toUpperCase()} •••• ${last4 ?? '••••'}`;
      return {
        provider: 'stripe',
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
    if (!PHONE_RE.test(phone.trim())) {
      throw new Error('Enter a valid phone number (e.g. +237650000000).');
    }
    const provider = gateway.toLowerCase();
    const last4 = phone.trim().slice(-4);
    const ref = `${provider}:${phone.trim()}`;
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
      toast.success('Payment method added');
      onAdded(created);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? billingErrorMessage(err, err.message) : billingErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add payment method</DialogTitle>
          <DialogDescription>
            Save a method to speed up checkout. We never store full card numbers or CVV.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Gateway / method selection */}
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {gateways.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => {
                    setGateway(g.value);
                    setError(null);
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
                </button>
              ))}
            </div>
          </div>

          {methodType === 'mobile_money' ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-phone">Mobile money number</Label>
                <Input
                  id="add-phone"
                  inputMode="tel"
                  placeholder="+237650000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={!!error}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-operator">Operator</Label>
                <Select value={operator} onValueChange={(v) => setOperator(v as PhoneOperator)}>
                  <SelectTrigger id="add-operator">
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
              <div className="space-y-1.5">
                <Label htmlFor="add-holder-mm">Account holder name (optional)</Label>
                <Input
                  id="add-holder-mm"
                  placeholder="Account holder"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <CardPreview holderName={holderName} />
              <div className="space-y-1.5">
                <Label htmlFor="add-holder">Card holder name</Label>
                <Input
                  id="add-holder"
                  placeholder="Name on card"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Card details</Label>
                <StripeCardField ref={cardRef} disabled={submitting} />
              </div>
            </div>
          )}

          {!forceDefault && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Set as default</p>
                <p className="text-xs text-muted-foreground">Pre-selected at checkout.</p>
              </div>
              <Switch checked={makeDefault} onCheckedChange={setMakeDefault} />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save method
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
