import { useCallback, useEffect, useState } from 'react';

import { fetchPaymentOptions } from '@/services/billing.service';
import type { PaymentProvider, PaymentProviderOption } from '@/types/billing.types';

export type PaymentOptionsStatus = 'loading' | 'ready' | 'error';

export interface PaymentOptionsState {
  status: PaymentOptionsStatus;
  /** In the server's order. Empty + `ready` means online payment is off. */
  providers: PaymentProviderOption[];
  /** Fetch again (the retry after a failed load). */
  reload: () => void;
  /**
   * Narrow to the fresh list a `422 PAYMENT_PROVIDER_UNAVAILABLE` carries in
   * `details.offered`. That list has names only, so a provider we hold no entry
   * for (switched on since the dialog opened) triggers a refetch to learn its
   * flow and fields.
   */
  applyOffered: (offered: readonly PaymentProvider[]) => void;
}

/**
 * What the agency can pay with right now — `GET /payments/options`, re-read
 * every time `open` turns true. Never cached across openings: an administrator
 * can switch a provider off, or move aggregators, between two purchases.
 */
export function usePaymentOptions(open: boolean): PaymentOptionsState {
  const [status, setStatus] = useState<PaymentOptionsStatus>('loading');
  const [providers, setProviders] = useState<PaymentProviderOption[]>([]);
  const [nonce, setNonce] = useState(0);

  // Each opening starts from `loading`, so a list from the previous opening is
  // never offered while the fresh one is on its way.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setStatus('loading');
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchPaymentOptions()
      .then((list) => {
        if (cancelled) return;
        setProviders(list);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [open, nonce]);

  const reload = useCallback(() => {
    setStatus('loading');
    setNonce((n) => n + 1);
  }, []);

  const applyOffered = useCallback(
    (offered: readonly PaymentProvider[]) => {
      if (offered.some((p) => !providers.some((o) => o.provider === p))) reload();
      setProviders((current) => current.filter((o) => offered.includes(o.provider)));
    },
    [providers, reload],
  );

  return { status, providers, reload, applyOffered };
}
