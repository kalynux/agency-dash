import { useNavigate } from 'react-router-dom';
import {
  Archive,
  File as FileIcon,
  FileText,
  HardDrive,
  Image as ImageIcon,
  Music,
  Video,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatFileSize, storageBarColor, storagePercent } from '@/lib/utils';
import type { MediaCategory, StorageUsage } from '@/types/file.types';

interface StorageUsageCardProps {
  storage: StorageUsage;
  /** Scroll the billing page to the Plans section (for the upgrade CTA). */
  onViewPlans?: () => void;
}

const CATEGORY_META: Record<MediaCategory, { label: string; icon: typeof HardDrive }> = {
  image: { label: 'Images', icon: ImageIcon },
  video: { label: 'Videos', icon: Video },
  document: { label: 'Documents', icon: FileText },
  audio: { label: 'Audio', icon: Music },
  archive: { label: 'Archives', icon: Archive },
  other: { label: 'Other', icon: FileIcon },
};

const CATEGORY_ORDER: MediaCategory[] = ['image', 'video', 'document', 'audio', 'archive', 'other'];

/**
 * Media storage against the plan cap (api-doc/agency/storage.md). Read live from
 * GET /files/storage — never from the plan record, whose `max_storage_bytes` an
 * admin can change at any time.
 */
export function StorageUsageCard({ storage, onViewPlans }: StorageUsageCardProps) {
  const navigate = useNavigate();
  const { usedBytes, limitBytes } = storage;
  const hasLimit = limitBytes !== null && limitBytes > 0;
  const pct = storagePercent(usedBytes, limitBytes);
  // Nudge once usage crosses the first alert band (storage.md §4).
  const nearFull = hasLimit && pct >= 80;

  // Only show categories that actually hold bytes, in a stable order.
  const categories = CATEGORY_ORDER.filter((c) => (storage.byCategory?.[c]?.bytes ?? 0) > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" /> Media storage
        </CardTitle>
        <CardDescription>
          {hasLimit
            ? `${formatFileSize(usedBytes)} of ${formatFileSize(limitBytes)} used`
            : `${formatFileSize(usedBytes)} used · no limit`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Used</span>
            <span className="font-medium">{hasLimit ? `${pct}%` : formatFileSize(usedBytes)}</span>
          </div>
          {hasLimit && <Progress value={pct} indicatorClassName={storageBarColor(pct)} />}
          {hasLimit && storage.remainingBytes !== null && (
            <p className="text-xs text-muted-foreground">
              {formatFileSize(storage.remainingBytes)} remaining
            </p>
          )}
        </div>

        {/* Per-category breakdown */}
        {categories.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {categories.map((c) => {
              const entry = storage.byCategory![c];
              const { label, icon: Icon } = CATEGORY_META[c];
              return (
                <div key={c} className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    {label}
                  </div>
                  <p className="mt-1 font-semibold">{formatFileSize(entry.bytes)}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.count} {entry.count === 1 ? 'file' : 'files'}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Near/over-full nudge */}
        {nearFull && (
          <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-700 dark:text-amber-500">
              {pct >= 100
                ? 'Your media storage is full. New uploads will be rejected until you free up space.'
                : `You've used ${pct}% of your media storage.`}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/media')}>
                Free up space
              </Button>
              {onViewPlans && (
                <Button size="sm" onClick={onViewPlans}>
                  Upgrade plan
                </Button>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Every file your agency owns counts here — your avatar, your business logo, anything you
          upload, and the delivery proofs your agents attach to their shipments.
        </p>
      </CardContent>
    </Card>
  );
}
