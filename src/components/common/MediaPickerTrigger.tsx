// ─── Media picker trigger ─────────────────────────────────────────────────────
// A single-file slot (avatar, logo, cover…) whose *preview itself* is the click
// target — no separate upload button. Clicking opens the MediaPicker filtered to
// the kinds the slot accepts; uploading happens inside the picker, so every file
// in the app goes through the one upload endpoint and comes back as an id.
//
// The caller stores a `StoredFileRef`: the id is what the PATCH/PUT sends, the
// url is for the preview, and `key`/`access` are what let the slot tell an empty
// state apart from a quota-blocked one after a reload.

import { useState, type ReactNode } from 'react';
import { ImagePlus } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { txStatic } from '@/i18n/tx';
import { MediaPicker } from '@/components/features/MediaPicker';
import {
  isQuotaBlockedFile,
  resolveFileUrl,
  toStoredFileRef,
  type StoredFileRef,
} from '@/services/files.service';
import type { FileKind } from '@/types/file.types';

/**
 * What a single-file slot holds. The same shape the form keeps for a file it
 * loaded from the API, so a pick and a reload are interchangeable — narrowed
 * only in that `url` is never `null` here: the picker refuses anything with no
 * public bytes below, so a *freshly picked* file always has one.
 */
export interface MediaRef extends StoredFileRef {
  url: string;
}

export interface MediaPickerTriggerProps {
  onSelect: (media: MediaRef) => void;
  /** Kinds this slot accepts — also seeds the picker's type filter. */
  acceptedTypes?: FileKind[];
  /** Overlay wording and accessible name, e.g. "Change logo". */
  label: string;
  /** Shape/size of the click target — the preview inside fills it. */
  className?: string;
  disabled?: boolean;
  children: ReactNode;
}

export function MediaPickerTrigger({
  onSelect,
  acceptedTypes = ['image'],
  label,
  className,
  disabled,
  children,
}: MediaPickerTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          'group relative block overflow-hidden transition-opacity',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          disabled ? 'cursor-default opacity-60' : 'cursor-pointer',
          className,
        )}
      >
        {children}
        {!disabled && (
          <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <ImagePlus className="h-5 w-5" />
            <span className="px-1 text-center text-[10px] font-medium leading-tight">{label}</span>
          </span>
        )}
      </button>

      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        acceptedTypes={acceptedTypes}
        onSelect={(picked) => {
          const file = picked[0];
          if (!file) return;
          // Say why, rather than swallowing the click. A blocked file is the
          // one no-URL case a user can actually reach and fix, so dropping the
          // pick in silence reads as a broken button.
          if (isQuotaBlockedFile(file)) {
            toast.error(txStatic('media:quotaBlocked.title'), {
              description: txStatic('media:quotaBlocked.body'),
            });
            return;
          }
          // `null` means the file has no public URL (an authorized storage
          // tree). Nothing in the media library is one, but a slot that stores
          // a URL cannot hold a placeholder for it — so drop the pick rather
          // than write a value that renders as a broken image later.
          const url = resolveFileUrl(file);
          if (url) onSelect({ ...toStoredFileRef(file), url });
        }}
      />
    </>
  );
}
