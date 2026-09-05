// The agent's delivery-proof photo.
//
// This is the one image in this dashboard that CANNOT be rendered from a URL.
// On 2026-08-19 three storage trees — `digital/`, `shipments/` and
// `ticket-attachments/` — left jovi-mall's static file mount, because the mount
// served the whole of `storage/` and a stored file's `url` *was* that path: any
// URL anyone had ever seen stayed fetchable forever, with no session. A delivery
// proof is a place and a time about a real customer's address, so it was exactly
// the wrong thing to leave on a public path.
//
// Every `FileDetail` under `shipments/` therefore reports `url: null` and
// `access: "authorized"`. The bytes come from the shipment's own route, scoped
// by the same `findByIdAndAgency` predicate the detail endpoint uses — so if you
// can read the shipment you can read its proof, and someone else's shipment 404s
// rather than 403s.
//
// See api-doc/files/private-files.md and api-doc/MIGRATION-2026-08.md § 3.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Loader2 } from 'lucide-react';

import { shipmentsService } from '@/services/shipments.service';
import { ApiError } from '@/types/api';
import { getApiErrorMessage } from '@/lib/errors';
import { canHaveDeliveryProof } from '@/components/shipments/shipment-actions';
import type { ShipmentStatus } from '@/types/shipment.types';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; url: string }
  /** No proof on this shipment — a `404`, which is a normal answer, not a fault. */
  | { kind: 'absent' }
  | { kind: 'error'; message: string };

export interface DeliveryProofPanelProps {
  shipmentId: string;
  status: ShipmentStatus;
}

/**
 * Fetches the proof on demand and renders it from an object URL.
 *
 * On demand rather than with the detail, because most shipments have no proof
 * and the only way to find out is to ask — there is no agency-side metadata
 * route, deliberately (the agency reads this record; it does not author it, and
 * there is no upload or delete twin).
 */
export function DeliveryProofPanel({ shipmentId, status }: DeliveryProofPanelProps) {
  const { t } = useTranslation(['shipments', 'common']);
  const [state, setState] = useState<State>({ kind: 'idle' });
  // Held in a ref as well as in state so the cleanup below can revoke the URL
  // without the effect depending on `state` — which would re-run it on every
  // transition and revoke the URL it had just created.
  const objectUrlRef = useRef<string | null>(null);

  const revoke = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const blob = await shipmentsService.getDeliveryProofFile(shipmentId);
      revoke();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setState({ kind: 'ready', url });
    } catch (err) {
      // 404 is "no proof recorded, OR not your shipment" — the backend answers
      // one code for both on purpose, so the existence of another agency's
      // shipment is never leaked. Either way there is nothing to show and
      // nothing has gone wrong, so it is a state rather than an error.
      if (err instanceof ApiError && err.status === 404) {
        setState({ kind: 'absent' });
        return;
      }
      setState({ kind: 'error', message: getApiErrorMessage(err) });
    }
  }, [shipmentId, revoke]);

  // Revoke on unmount — an object URL pins its blob in memory until it is.
  //
  // There is deliberately no "reset when `shipmentId` changes" effect: the
  // parent gives this component a `key` of the shipment id, so pointing the
  // sheet at a different shipment remounts it and every piece of state above
  // starts fresh. That is both cheaper and safer than resetting from an effect,
  // which would set state during a render pass it cannot see the end of.
  useEffect(() => revoke, [revoke]);

  if (!canHaveDeliveryProof(status)) return null;

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('detail.deliveryProof')}
      </h3>

      {state.kind === 'idle' && (
        <button
          type="button"
          onClick={load}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Camera className="h-4 w-4" />
          {t('detail.deliveryProofShow')}
        </button>
      )}

      {state.kind === 'loading' && (
        <div className="flex items-center justify-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('detail.deliveryProofLoading')}
        </div>
      )}

      {state.kind === 'ready' && (
        <img
          src={state.url}
          alt={t('detail.deliveryProofAlt')}
          className="max-h-72 w-full rounded-lg border object-contain"
        />
      )}

      {state.kind === 'absent' && (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          {t('detail.deliveryProofNone')}
        </p>
      )}

      {state.kind === 'error' && (
        <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <p>{state.message}</p>
          <button type="button" onClick={load} className="font-medium underline">
            {t('common:actions.retry')}
          </button>
        </div>
      )}
    </section>
  );
}
