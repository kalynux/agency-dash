// The one-photo slot on the remittance form (2026-09-27): the transfer receipt
// or a screenshot of it, required to declare.
//
// The server takes exactly one JPEG, PNG or WebP of at most 10 MB. `accept`
// steers the file dialog but guarantees nothing — an iPhone photo can still
// arrive as HEIC — so the type and size are checked here too, and the server's
// own refusal is still shown clearly if something slips through.
//
// On the native shell the camera-first `UploadSourceSheet` is offered, the same
// way the KYC slots do it: "photograph the receipt" is the common case.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { UploadSourceSheet } from '@/components/common/UploadSourceSheet';
import { nativeMediaAvailable } from '@/platform/media';
import { formatFileSize, cn } from '@/lib/utils';

const COD_PROOF_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const COD_PROOF_MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = COD_PROOF_MIME_TYPES.join(',');

/** True when the server would take this file as a proof. */
function isAcceptableCodProof(file: File): boolean {
  return (COD_PROOF_MIME_TYPES as readonly string[]).includes(file.type) && file.size <= COD_PROOF_MAX_BYTES;
}

export interface CodProofPickerProps {
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  className?: string;
}

export function CodProofPicker({ value, onChange, disabled, className }: CodProofPickerProps) {
  const { t } = useTranslation('cash');
  const inputRef = useRef<HTMLInputElement>(null);
  const [sourceOpen, setSourceOpen] = useState(false);

  // A local preview of the picked file — no request involved.
  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const accept = (picked: FileList | File[]) => {
    const file = Array.from(picked)[0];
    if (!file) return;
    if (!isAcceptableCodProof(file)) {
      toast.error(t('proof.invalid'));
      return;
    }
    onChange(file);
  };

  const requestPick = () => {
    if (nativeMediaAvailable) setSourceOpen(true);
    else inputRef.current?.click();
  };

  return (
    <div className={cn('flex min-w-0 items-center gap-3', value && 'rounded-lg border p-2', className)}>
      {value && previewUrl ? (
        <>
          <img
            src={previewUrl}
            alt={t('proof.alt')}
            className="h-12 w-12 shrink-0 rounded-md border object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{value.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(value.size)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={requestPick}
          >
            {t('proof.replace')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('proof.remove')}
            disabled={disabled}
            onClick={() => onChange(null)}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        // A whole tile rather than a small button: in the form sheet this is
        // the one required thing that isn't a text field, and it should read
        // as a slot waiting to be filled.
        <button
          type="button"
          disabled={disabled}
          onClick={requestPick}
          className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ImagePlus className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium">{t('proof.attach')}</span>
          <span className="text-xs text-muted-foreground">{t('proof.hint')}</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) accept(e.target.files);
          // Picking the same file twice in a row fires no `change` otherwise.
          e.target.value = '';
        }}
      />
      <UploadSourceSheet
        open={sourceOpen}
        onOpenChange={setSourceOpen}
        onPicked={accept}
        onBrowseFiles={() => inputRef.current?.click()}
        multiple={false}
        limit={1}
        allowVideo={false}
      />
    </div>
  );
}
