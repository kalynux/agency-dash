// One document slot — its files, its cardinality, and the way into it.
//
// Two cardinalities, and they behave differently enough to say out loud:
//   • `id_card_front` / `id_card_back` / `selfie_with_id` hold ONE file, and
//     re-uploading REPLACES it (the previous file is deleted immediately).
//   • `home_address_sketch` / `store_address_sketch` hold MANY (≤ the record's
//     `limits.multiSlotMaxFiles`) and uploading APPENDS.
//
// The multi-slot ceiling is checked by the backend against what is already in
// the slot, *before* anything uploads — so an over-full selection is refused
// whole (`422 KYC_SLOT_FULL`), never partially accepted. `validateKycSelection`
// says that in a sentence here rather than letting it arrive as a status code.

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import {
  KYC_ACCEPT_ATTRIBUTE,
  isSingleValueSlot,
  validateKycSelection,
} from '@/services/kyc.service';
import { nativeMediaAvailable } from '@/platform/media';
import { UploadSourceSheet } from '@/components/common/UploadSourceSheet';
import { InfoHint } from '@/components/common/InfoHint';
import { cn } from '@/lib/utils';
import { KycDocumentRow } from './KycDocumentRow';
import type { KycDocumentRef, KycDocumentSlot } from '@/types/kyc.types';

import { Button } from '@/components/ui/button';

export interface KycDocumentSlotCardProps {
  slot: KycDocumentSlot;
  files: KycDocumentRef[];
  /** `record.limits.multiSlotMaxFiles` — ignored for single-value slots. */
  multiSlotMax: number;
  /** Whether the reviewers require this slot OF THIS AGENCY. */
  required: boolean;
  /** One line saying why it is (or is not) being asked for. Conditional slots only. */
  conditionNote?: string;
  /** Under review or verified: no writes, and no buttons that can only 409. */
  locked: boolean;
  onUpload: (files: File[]) => Promise<void>;
  onDelete: (fileId: string) => Promise<void>;
}

export function KycDocumentSlotCard({
  slot,
  files,
  multiSlotMax,
  required,
  conditionNote,
  locked,
  onUpload,
  onDelete,
}: KycDocumentSlotCardProps) {
  const { t } = useTranslation(['account', 'common']);
  const inputRef = useRef<HTMLInputElement>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const single = isSingleValueSlot(slot);
  // A single-value slot always has room for one: the upload replaces whatever
  // is there. A multi-value slot has room for what the ceiling has left.
  const room = single ? 1 : Math.max(0, multiSlotMax - files.length);
  const full = room === 0;

  const handleFiles = async (picked: FileList | File[]) => {
    const arr = Array.from(picked);
    if (arr.length === 0) return;

    const invalid = validateKycSelection(arr, room);
    if (invalid) {
      toast.error(invalid);
      return;
    }

    setBusy(true);
    try {
      await onUpload(arr);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    setDeletingId(fileId);
    try {
      await onDelete(fileId);
    } finally {
      setDeletingId(null);
    }
  };

  const requestUpload = () => {
    if (nativeMediaAvailable) setSourceOpen(true);
    else inputRef.current?.click();
  };

  const uploadLabel = single && files.length > 0 ? t('verification.slots.replace') : t('verification.slots.add');
  const title = t(`verification.slots.${slot}.title` as never) as string;
  const description = t(`verification.slots.${slot}.description` as never) as string;

  return (
    <div className="space-y-3 md:rounded-lg md:border md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            {title}
            {/* What the slot wants, and why a conditional one is (not) asked
                for: inline on desktop, one tap away on a phone. Required is
                the norm, so only an optional slot is marked — "(optional)"
                after the title, like every other form, instead of a pill on
                nearly every slot. */}
            <InfoHint className="md:hidden" label={t('common:form.aboutSection', { title })}>
              {description}
              {conditionNote && <span className="mt-2 block">{conditionNote}</span>}
            </InfoHint>
            {!required && (
              <span className="font-normal lowercase text-muted-foreground">
                ({t('verification.checklist.optional')})
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground max-md:hidden">{description}</p>
          {conditionNote && (
            <p className="mt-1 text-xs text-muted-foreground max-md:hidden">{conditionNote}</p>
          )}
        </div>

        {!locked && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={busy || full}
            onClick={requestUpload}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploadLabel}
          </Button>
        )}
      </div>

      {files.length > 0 ? (
        <div className="space-y-2">
          {files.map((doc) => (
            <KycDocumentRow
              key={doc.id}
              doc={doc}
              onDelete={locked ? undefined : () => void handleDelete(doc.id)}
              deleting={deletingId === doc.id}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground md:py-4">
          {t('verification.slots.empty')}
        </p>
      )}

      {/* "Full" explains a disabled button, so it stays at every width; the
          running count is desktop-only detail. */}
      {!single && (
        <p className={cn('text-xs text-muted-foreground', !full && 'max-md:hidden')}>
          {full
            ? t('verification.slots.full', { max: multiSlotMax })
            : t('verification.slots.remaining', { count: room, max: multiSlotMax })}
        </p>
      )}

      {!locked && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple={!single}
            accept={KYC_ACCEPT_ATTRIBUTE}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              // Same file twice in a row fires no `change` unless the input is
              // cleared — a replace of an identical filename is a real case here.
              e.target.value = '';
            }}
          />
          <UploadSourceSheet
            open={sourceOpen}
            onOpenChange={setSourceOpen}
            onPicked={(picked) => void handleFiles(picked)}
            onBrowseFiles={() => inputRef.current?.click()}
            multiple={!single}
            limit={room}
            // Nothing here is a video, and the KYC upload config would refuse
            // one; offering the choice is offering a failure.
            allowVideo={false}
          />
        </>
      )}
    </div>
  );
}
