import { useRef } from 'react';
import { Loader2, Paperclip, X, FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFileUpload } from '@/hooks/useFileUpload';
import type { UploadedFile } from '@/types/file.types';

export interface FileUploadFieldProps {
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  /** Max total files (e.g. tickets cap at 5 attachments). */
  max?: number;
  accept?: string;
  label?: string;
  disabled?: boolean;
}

/** Reusable "upload → chips" control. Uploads immediately, then holds the
 * returned file metadata so the caller can submit the `id`s. */
export function FileUploadField({
  value,
  onChange,
  max = 5,
  accept,
  label = 'Attach files',
  disabled,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { isUploading, upload } = useFileUpload();

  const remaining = max - value.length;

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, remaining);
    const uploaded = await upload(files);
    if (uploaded) onChange([...value, ...uploaded]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (id: string) => onChange(value.filter((f) => f.id !== id));

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={disabled || isUploading || remaining <= 0}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        {label}
        <span className="text-xs text-muted-foreground">
          ({value.length}/{max})
        </span>
      </Button>

      {value.length > 0 && (
        <div className="space-y-1">
          {value.map((f) => (
            <div key={f.id} className="flex items-center gap-2 text-sm rounded-md border px-2 py-1">
              <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate flex-1">{f.originalName}</span>
              <button type="button" onClick={() => remove(f.id)} className="text-muted-foreground hover:text-destructive">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
