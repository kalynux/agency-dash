import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Paperclip, X, FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MediaPicker } from '@/components/features/MediaPicker';
import type { ApiFile, FileKind } from '@/types/file.types';

export interface FileUploadFieldProps {
  value: ApiFile[];
  onChange: (files: ApiFile[]) => void;
  /** Max total files (e.g. tickets cap at 5 attachments). */
  max?: number;
  /** Kinds this field accepts — seeds the picker's filter and gates selection. */
  acceptedTypes?: FileKind[];
  label?: string;
  disabled?: boolean;
}

/**
 * Reusable "attach files → chips" control. Picking (and uploading) happens in the
 * MediaPicker, so files reach the backend through the single `/files/upload`
 * endpoint; this field only holds the returned metadata so the caller can submit
 * the `id`s.
 */
export function FileUploadField({
  value,
  onChange,
  max = 5,
  acceptedTypes,
  label,
  disabled,
}: FileUploadFieldProps) {
  const { t } = useTranslation('common');
  const [pickerOpen, setPickerOpen] = useState(false);

  const remaining = max - value.length;
  const alreadySelectedIds = value.map((f) => f.id);

  const remove = (id: string) => onChange(value.filter((f) => f.id !== id));

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={disabled || remaining <= 0}
        onClick={() => setPickerOpen(true)}
      >
        <Paperclip className="w-4 h-4" />
        {label ?? t('media.attachFiles')}
        <span className="text-xs text-muted-foreground">
          ({value.length}/{max})
        </span>
      </Button>

      {value.length > 0 && (
        <div className="space-y-1">
          {value.map((f) => (
            <div key={f.id} className="flex items-center gap-2 text-sm rounded-md border px-2 py-1">
              <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate flex-1">{f.originalName ?? 'Untitled'}</span>
              <button type="button" onClick={() => remove(f.id)} className="text-muted-foreground hover:text-destructive">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        multiple
        maxFiles={remaining}
        acceptedTypes={acceptedTypes}
        alreadySelectedIds={alreadySelectedIds}
        onSelect={(picked) => onChange([...value, ...picked.slice(0, remaining)])}
      />
    </div>
  );
}
