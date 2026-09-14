// One stored KYC document: what it is, and — for an image — the only preview the
// backend allows.
//
// ⚠ **`url` is always `null` in this module** and that is the correct answer,
// not a broken file: `kyc/` is a PRIVATE storage tree, so the bytes come from
// `GET /api/agency/kyc/documents/:fileId/content` — fetched WITH the session and
// turned into an object URL. An identity card on a public path stays fetchable
// forever by anyone who ever sees the link, which is what `null` exists to stop.
//
// **Images preview; PDFs do not.** A PDF is rendered as a labelled file row —
// name, format, size — and nothing is fetched for it. Neither half of the
// alternative works: an Android WebView has no built-in PDF viewer, so an inline
// <iframe> paints a blank rectangle, and `Browser.open` cannot load a `blob:`
// URL, so there is nothing to hand it to either. A row that says what the file
// is beats a control that behaves differently on two platforms.
//
// Image bytes are fetched on demand rather than on mount, the same way
// `shipments/DeliveryProofPanel` handles the other private tree in this app. The
// documents are up to 10 MB each and five slots would be a lot of traffic for a
// screen most visits only read the STATUS of.
//
// See api-doc/agency/identity-verification.md § Displaying a document.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, FileText, HardDrive, ImageIcon, Loader2, Trash2 } from 'lucide-react';

import {
  kycService,
  documentTypeLabel,
  isPreviewableImage,
  isQuotaBlockedDocument,
} from '@/services/kyc.service';
import { getApiErrorMessage } from '@/lib/errors';
import { formatFileSize } from '@/lib/utils';
import type { KycDocumentRef } from '@/types/kyc.types';

import { Button } from '@/components/ui/button';

/** Where an agency lifts a storage block. Same target as the `plans` alias. */
const PLAN_ROUTE = '/dashboard/account/billing';

type PreviewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; url: string }
  | { kind: 'error'; message: string };

export interface KycDocumentRowProps {
  doc: KycDocumentRef;
  /** Omit while the record is locked — there is then nothing to remove. */
  onDelete?: () => void;
  deleting?: boolean;
}

export function KycDocumentRow({ doc, onDelete, deleting }: KycDocumentRowProps) {
  const { t } = useTranslation(['account', 'common']);
  const [state, setState] = useState<PreviewState>({ kind: 'idle' });

  // Held in a ref as well as in state so cleanup can revoke without the effect
  // depending on `state` — which would re-run on every transition and revoke the
  // URL it had just created. An object URL pins its blob in memory until it is.
  const objectUrlRef = useRef<string | null>(null);

  const revoke = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => revoke, [revoke]);

  const isImage = isPreviewableImage(doc.mimeType);
  const blocked = isQuotaBlockedDocument(doc);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const blob = await kycService.getDocumentContent(doc.id);
      revoke();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setState({ kind: 'ready', url });
    } catch (err) {
      setState({ kind: 'error', message: getApiErrorMessage(err) });
    }
  }, [doc.id, revoke]);

  const hide = useCallback(() => {
    revoke();
    setState({ kind: 'idle' });
  }, [revoke]);

  const TypeIcon = isImage ? ImageIcon : FileText;
  const name = doc.originalName ?? t('verification.document.untitled');
  const typeLabel = documentTypeLabel(doc);
  // "PDF · 215 KB", or just the size when the type is unknowable.
  const meta = [typeLabel, formatFileSize(doc.size)].filter(Boolean).join(' · ');

  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-3 p-3">
        <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{name}</p>
          <p className="text-xs text-muted-foreground">{meta}</p>
        </div>

        {/* A billing state, not a privacy one: the file is intact and the content
            route will not serve it either, so "missing" and "deleted" are both
            the wrong word. */}
        {blocked ? (
          <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <HardDrive className="h-3.5 w-3.5" />
            {t('verification.document.quotaBlocked')}
          </span>
        ) : isImage ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            disabled={state.kind === 'loading'}
            onClick={state.kind === 'ready' ? hide : load}
          >
            {state.kind === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : state.kind === 'ready' ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            <span className="max-sm:sr-only">
              {state.kind === 'ready'
                ? t('verification.document.hide')
                : t('verification.document.view')}
            </span>
          </Button>
        ) : (
          // Sits exactly where the View button would be, so the absence reads as
          // a property of the file rather than as something failing to load.
          <span className="text-xs text-muted-foreground">
            {t('verification.document.noPreview')}
          </span>
        )}

        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('verification.document.remove', { name })}
            disabled={deleting}
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {blocked && (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          {t('verification.document.quotaBlockedHint')}{' '}
          <Link to={PLAN_ROUTE} className="font-medium text-primary underline-offset-4 hover:underline">
            {t('verification.document.quotaBlockedAction')}
          </Link>
        </p>
      )}

      {state.kind === 'ready' && (
        <div className="border-t p-3">
          <img src={state.url} alt={name} className="max-h-80 w-full rounded-md object-contain" />
        </div>
      )}

      {state.kind === 'error' && (
        <div className="space-y-1 border-t px-3 py-2 text-xs text-destructive">
          <p>{state.message}</p>
          <button type="button" onClick={load} className="font-medium underline">
            {t('common:actions.retry')}
          </button>
        </div>
      )}
    </div>
  );
}
