import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Upload, FileText, ImageIcon, Download, Globe, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { MediaPicker } from '@/components/features/MediaPicker';
import { ticketsService } from '@/services/tickets.service';
import { getApiErrorMessage } from '@/lib/errors';
import { FollowerSelect } from './FollowerSelect';
import { MAX_ATTACHMENTS, formatFileSize, roleLabel } from './ticket.constants';
import type { ApiFile } from '@/types/file.types';
import type { TicketAttachment, TicketActor } from '@/types/ticket.types';

type VisibilityInput = 'PUBLIC' | 'PRIVATE';

export function AttachmentsPanel({
  ticketId, followers, readOnly = false,
}: { ticketId: string; followers: TicketActor[]; readOnly?: boolean }) {
  const { t } = useTranslation('tickets');
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [visibility, setVisibility] = useState<VisibilityInput>('PUBLIC');
  const [viewerIds, setViewerIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    ticketsService
      .listAttachments(ticketId)
      .then((res) => active && setAttachments(res.data))
      .catch((err) => {
        if (active) toast.error(getApiErrorMessage(err));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [ticketId]);

  const remaining = MAX_ATTACHMENTS - attachments.length;
  const atLimit = remaining <= 0;

  /** Files come from the media library already uploaded — we only link them here. */
  async function attachPicked(picked: ApiFile[]) {
    const toAttach = picked.slice(0, remaining);
    if (toAttach.length === 0) return;
    setBusy(true);
    try {
      for (const f of toAttach) {
        const res = await ticketsService.addAttachment(
          ticketId,
          f.id,
          visibility,
          visibility === 'PRIVATE' && viewerIds.length ? viewerIds : undefined,
        );
        setAttachments((prev) => [...prev, res.data]);
      }
      toast.success(t('attachments.attached', { count: toAttach.length }));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const uploading = busy;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{t('attachments.title')}</h3>
        {!loading && (
          <span className="text-xs text-muted-foreground">
            {t('attachments.counter', { current: attachments.length, max: MAX_ATTACHMENTS })}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <ul className="space-y-2">
          {attachments.map((att) => {
            const isImage = att.mimeType.startsWith('image/');
            const uploader = att.uploadedByActor?.name ?? roleLabel(att.uploadedByRole);
            return (
              <li key={att.id} className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {isImage ? (
                    <img src={att.url} alt={att.fileName} crossOrigin="use-credentials" className="h-full w-full object-cover" />
                  ) : (
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{att.fileName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t('attachments.uploadedBy', {
                      size: formatFileSize(att.fileSize),
                      name: uploader,
                    })}
                  </p>
                </div>
                <a
                  href={att.url}
                  target="_blank"
                  rel="noreferrer"
                  download={att.fileName}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={t('attachments.download', { name: att.fileName })}
                >
                  <Download className="h-4 w-4" />
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && readOnly && attachments.length === 0 && (
        <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm text-muted-foreground/70">
          <Lock className="h-3.5 w-3.5" />
          {t('attachments.closed')}
        </p>
      )}

      {!loading && !readOnly && !atLimit && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border p-0.5">
              <VisibilityToggle
                active={visibility === 'PUBLIC'}
                onClick={() => { setVisibility('PUBLIC'); setViewerIds([]); }}
                icon={<Globe className="h-3.5 w-3.5" />}
                label={t('attachments.public')}
              />
              <VisibilityToggle
                active={visibility === 'PRIVATE'}
                onClick={() => setVisibility('PRIVATE')}
                icon={<Lock className="h-3.5 w-3.5" />}
                label={t('attachments.private')}
              />
            </div>
            {visibility === 'PRIVATE' && (
              <FollowerSelect followers={followers} value={viewerIds} onChange={setViewerIds} />
            )}
          </div>

          <button
            type="button"
            disabled={uploading}
            onClick={() => setPickerOpen(true)}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm font-medium transition-colors',
              'text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? t('attachments.attaching') : t('attachments.add')}
          </button>

          <MediaPicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            multiple
            maxFiles={remaining}
            onSelect={attachPicked}
          />
        </div>
      )}

      {!loading && !readOnly && atLimit && (
        <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm text-muted-foreground/70">
          <ImageIcon className="h-4 w-4" />
          {t('attachments.atLimit', { max: MAX_ATTACHMENTS })}
        </p>
      )}
    </section>
  );
}

function VisibilityToggle({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
        active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
