// The photo attached to a COD hand-over — the agent's evidence on a deposit, or
// the agency's own receipt on a remittance (2026-09-27).
//
// Like the delivery proof (`shipments/DeliveryProofPanel`), this is a PRIVATE
// file: `cod-proofs/` is not on the static mount, `url` is always `null`, and the
// bytes come from the record's own `…/proof/file` route, fetched with the
// session and turned into an object URL. Receipts carry account numbers and
// names, which is why they never had a public path.
//
// `proof: null` is a normal answer, not a fault: a deposit recorded at the desk
// has none, and neither does anything declared before the change.
//
// See api-doc/agency/FRONTEND-CHANGELOG-cod-cash-proof.md § 2–3.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Loader2, RotateCw } from 'lucide-react';

import { ResponsiveModal } from '@/components/common/ResponsiveModal';
import { ApiError } from '@/types/api';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import type { CodProof } from '@/types/cod-cash.types';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; url: string }
  /** `404` — no photo on the record after all. A state, not an error. */
  | { kind: 'absent' }
  | { kind: 'error'; message: string };

export interface CodProofImageProps {
  proof: CodProof | null | undefined;
  /** Fetches the bytes — `codCashService.getDepositProofFile(id)` or the remittance twin. */
  fetchFile: () => Promise<Blob>;
  /**
   * Load the thumbnail on mount instead of on a tap. Set it where the photo is
   * the thing being decided on — a declaration awaiting Confirm / Reject —
   * and leave it off for history rows, which most visits only skim.
   */
  autoLoad?: boolean;
  /** Title of the full-size viewer, e.g. the agent's name. */
  title?: string;
  className?: string;
}

/**
 * A compact thumbnail that opens the photo full size.
 *
 * Remount it (via `key`) to point it at another record; it does not reset
 * itself when `fetchFile` changes, for the same reason `DeliveryProofPanel`
 * doesn't.
 */
export function CodProofImage({ proof, fetchFile, autoLoad = false, title, className }: CodProofImageProps) {
  const { t } = useTranslation(['cash', 'common']);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [viewerOpen, setViewerOpen] = useState(false);
  // Held in a ref as well as in state so cleanup can revoke without the effect
  // depending on `state` — which would re-run on every transition and revoke
  // the URL it had just created.
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
      const blob = await fetchFile();
      revoke();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setState({ kind: 'ready', url });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setState({ kind: 'absent' });
        return;
      }
      setState({ kind: 'error', message: getApiErrorMessage(err) });
    }
  }, [fetchFile, revoke]);

  useEffect(() => revoke, [revoke]);

  const hasProof = !!proof;
  useEffect(() => {
    if (autoLoad && hasProof) void load();
    // Once, on mount — `load` is stable per record because the parent keys us.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!proof || state.kind === 'absent') {
    return <span className={cn('text-xs text-muted-foreground', className)}>{t('proof.none')}</span>;
  }

  if (state.kind === 'idle') {
    return (
      <button
        type="button"
        onClick={load}
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline',
          className,
        )}
      >
        <Camera className="h-3.5 w-3.5" />
        {t('proof.view')}
      </button>
    );
  }

  if (state.kind === 'loading') {
    return (
      <span
        className={cn(
          'inline-flex h-12 w-12 items-center justify-center rounded-md border bg-muted text-muted-foreground',
          className,
        )}
        aria-label={t('proof.loading')}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
    );
  }

  if (state.kind === 'error') {
    return (
      <button
        type="button"
        onClick={load}
        title={state.message}
        className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-destructive underline-offset-4 hover:underline', className)}
      >
        <RotateCw className="h-3.5 w-3.5" />
        {t('proof.loadFailed')}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setViewerOpen(true)}
        aria-label={t('proof.open')}
        className={cn(
          'inline-block h-12 w-12 shrink-0 overflow-hidden rounded-md border transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <img src={state.url} alt={t('proof.alt')} className="h-full w-full object-cover" />
      </button>

      <ResponsiveModal
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        title={title ?? t('proof.viewerTitle')}
        description={proof.originalName}
        desktopClassName="sm:max-w-3xl"
      >
        <img
          src={state.url}
          alt={t('proof.alt')}
          className="max-h-[75dvh] w-full rounded-md object-contain"
        />
      </ResponsiveModal>
    </>
  );
}
