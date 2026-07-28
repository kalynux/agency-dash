import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  getStripe,
  type StripeInstance,
  type StripeElements,
  type StripePaymentElement as StripePaymentElementInstance,
} from '@/lib/stripe';

/** Outcome of confirming the card payment in-page. */
export type StripeConfirmOutcome =
  | { status: 'succeeded' }
  /** Stripe is finalizing (webhook will apply) — poll verify. */
  | { status: 'processing' }
  /** A bank redirect (3-D Secure) is taking over — the page will navigate away. */
  | { status: 'redirecting' };

export interface StripePaymentElementHandle {
  /**
   * Confirm the PaymentIntent bound to this element. With `redirect: 'if_required'`
   * Stripe resolves in-page when no bank redirect is needed; otherwise it navigates
   * to `returnUrl` (and this promise never resolves — `redirecting`).
   * Throws with a user-facing message on a decline / validation error.
   */
  confirm(returnUrl: string): Promise<StripeConfirmOutcome>;
}

interface StripePaymentElementProps {
  /** PaymentIntent client secret from the initiate response. */
  clientSecret: string;
  disabled?: boolean;
  /** Called once the element has mounted and is ready for input. */
  onReady?: () => void;
}

/**
 * Mounts Stripe's Payment Element bound to a PaymentIntent `clientSecret`. The card
 * details stay inside Stripe's iframe and never touch our code. The parent calls
 * `confirm()` (via ref) on submit; Stripe handles 3-D Secure / redirects.
 */
export const StripePaymentElement = forwardRef<StripePaymentElementHandle, StripePaymentElementProps>(
  function StripePaymentElement({ clientSecret, disabled, onReady }, ref) {
    const mountRef = useRef<HTMLDivElement>(null);
    const stripeRef = useRef<StripeInstance | null>(null);
    const elementsRef = useRef<StripeElements | null>(null);
    const paymentElRef = useRef<StripePaymentElementInstance | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

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
          const elements = stripe.elements({ clientSecret });
          const paymentEl = elements.create('payment', {
            layout: 'tabs',
          });
          paymentEl.mount(mountRef.current);
          paymentEl.on('ready', () => {
            if (!cancelled) {
              setLoading(false);
              onReady?.();
            }
          });
          elementsRef.current = elements;
          paymentElRef.current = paymentEl;
        } catch {
          if (!cancelled) {
            setLoadError('Could not load the card form. Please try again.');
            setLoading(false);
          }
        }
      })();
      return () => {
        cancelled = true;
        paymentElRef.current?.destroy();
        paymentElRef.current = null;
        elementsRef.current = null;
      };
      // clientSecret is stable for the lifetime of this element (one PaymentIntent).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientSecret]);

    useImperativeHandle(ref, () => ({
      async confirm(returnUrl: string): Promise<StripeConfirmOutcome> {
        if (!stripeRef.current || !elementsRef.current) {
          throw new Error('Card form is not ready yet.');
        }
        const { error, paymentIntent } = await stripeRef.current.confirmPayment({
          elements: elementsRef.current,
          confirmParams: { return_url: returnUrl },
          // Stay in-page when no 3-D Secure redirect is needed.
          redirect: 'if_required',
        });

        if (error) {
          throw new Error(error.message ?? 'Your card could not be charged. Please try again.');
        }
        // No error and no paymentIntent → Stripe is navigating to return_url (3-D Secure).
        if (!paymentIntent) return { status: 'redirecting' };

        switch (paymentIntent.status) {
          case 'succeeded':
            return { status: 'succeeded' };
          case 'processing':
            return { status: 'processing' };
          case 'requires_action':
            // A redirect-based action took over.
            return { status: 'redirecting' };
          default:
            throw new Error('The card payment was not completed. Please try again.');
        }
      },
    }));

    if (loadError) {
      return <p className="text-sm text-destructive">{loadError}</p>;
    }

    return (
      <div className="space-y-1.5">
        <div
          className="relative rounded-md border bg-background px-3 py-3 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-60"
          data-disabled={disabled}
        >
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading secure card form…
            </div>
          )}
          <div ref={mountRef} className={loading ? 'hidden' : ''} />
        </div>
      </div>
    );
  },
);
