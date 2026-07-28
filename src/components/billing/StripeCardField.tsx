import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getStripe, type StripeCardElement, type StripeInstance } from '@/lib/stripe';

/** Card display metadata + instrument id captured when saving a card. */
export interface SavedCardResult {
  /** The gateway instrument id (`pm_…`) to store as `gateway_instrument_id`. */
  instrumentId: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

export interface StripeCardFieldHandle {
  /**
   * Create a reusable PaymentMethod for saving. Returns the instrument id (`pm_…`)
   * plus display metadata, or throws with a message.
   */
  createPaymentMethod(holderName?: string): Promise<SavedCardResult>;
}

/**
 * Mounts a Stripe Elements card field using the hosted Stripe.js script. The card
 * details stay inside Stripe's iframe and never touch our code. The parent calls
 * `createPaymentMethod()` (via ref) to obtain a reusable instrument id when saving
 * a card. (Self-serve plan/credit purchases use the Payment Element instead — see
 * `StripePaymentElement`.)
 */
export const StripeCardField = forwardRef<StripeCardFieldHandle, { disabled?: boolean }>(
  function StripeCardField({ disabled }, ref) {
    const mountRef = useRef<HTMLDivElement>(null);
    const stripeRef = useRef<StripeInstance | null>(null);
    const cardRef = useRef<StripeCardElement | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [cardError, setCardError] = useState<string | null>(null);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const stripe = await getStripe();
          if (cancelled) return;
          if (!stripe || !mountRef.current) {
            setLoadError('Card payments are unavailable right now.');
            setLoading(false);
            return;
          }
          stripeRef.current = stripe;
          const elements = stripe.elements();
          const card = elements.create('card', {
            style: {
              base: { fontSize: '16px', color: '#111827', '::placeholder': { color: '#9ca3af' } },
            },
          });
          card.mount(mountRef.current);
          card.on('change', (ev) => setCardError(ev.error?.message ?? null));
          cardRef.current = card;
          setLoading(false);
        } catch {
          if (!cancelled) {
            setLoadError('Could not load the card form. Please try again.');
            setLoading(false);
          }
        }
      })();
      return () => {
        cancelled = true;
        cardRef.current?.destroy();
        cardRef.current = null;
      };
    }, []);

    useImperativeHandle(ref, () => ({
      async createPaymentMethod(holderName?: string) {
        if (!stripeRef.current || !cardRef.current) {
          throw new Error('Card form is not ready yet.');
        }
        const { paymentMethod, error } = await stripeRef.current.createPaymentMethod({
          type: 'card',
          card: cardRef.current,
          billing_details: holderName ? { name: holderName } : undefined,
        });
        if (error || !paymentMethod) {
          const msg = error?.message ?? 'Could not validate the card.';
          setCardError(msg);
          throw new Error(msg);
        }
        return {
          instrumentId: paymentMethod.id,
          brand: paymentMethod.card?.brand ?? null,
          last4: paymentMethod.card?.last4 ?? null,
          expMonth: paymentMethod.card?.exp_month ?? null,
          expYear: paymentMethod.card?.exp_year ?? null,
        };
      },
    }));

    if (loadError) {
      return <p className="text-sm text-destructive">{loadError}</p>;
    }

    return (
      <div className="space-y-1.5">
        <div
          className="relative rounded-md border bg-background px-3 py-3 data-[disabled=true]:opacity-60"
          data-disabled={disabled}
        >
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading card form…
            </div>
          )}
          <div ref={mountRef} className={loading ? 'hidden' : ''} />
        </div>
        {cardError && <p className="text-xs text-destructive">{cardError}</p>}
      </div>
    );
  },
);
