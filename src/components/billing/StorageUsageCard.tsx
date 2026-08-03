import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { sectionRuleClass, sectionSurfaceClass } from '@/components/layout/PageContainer';
import { cn, formatFileSize, storageBarColor, storagePercent } from '@/lib/utils';
import type { MediaCategory, StorageUsage } from '@/types/file.types';

interface StorageUsageCardProps {
  storage: StorageUsage;
  /** Scroll the billing page to the Plans section (for the upgrade CTA). */
  onViewPlans?: () => void;
}

const CATEGORY_ICONS: Record<MediaCategory, typeof HardDrive> = {
  image: ImageIcon,
  video: Video,
  document: FileText,
  audio: Music,
  archive: Archive,
  other: FileIcon,
};

const CATEGORY_ORDER: MediaCategory[] = ['image', 'video', 'document', 'audio', 'archive', 'other'];

/**
 * Media storage against the plan cap (api-doc/agency/storage.md). Read live from
 * GET /files/storage — never from the plan record, whose `max_storage_bytes` an
 * admin can change at any time.
 */
export function StorageUsageCard({ storage, onViewPlans }: StorageUsageCardProps) {
  const { t } = useTranslation(['billing', 'common']);
  const navigate = useNavigate();
  const { usedBytes, limitBytes } = storage;
  const hasLimit = limitBytes !== null && limitBytes > 0;
  const pct = storagePercent(usedBytes, limitBytes);
  // Nudge once usage crosses the first alert band (storage.md §4).
  const nearFull = hasLimit && pct >= 80;

  // Only show categories that actually hold bytes, in a stable order.
  const categories = CATEGORY_ORDER.filter((c) => (storage.byCategory?.[c]?.bytes ?? 0) > 0);

  return (
    <Card className={cn(sectionSurfaceClass, sectionRuleClass)}>
      <CardHeader className="max-md:px-0">
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" /> {t('storage.title')}
        </CardTitle>
        <CardDescription>
          {hasLimit
            ? t('storage.usedOf', {
                used: formatFileSize(usedBytes),
                limit: formatFileSize(limitBytes),
              })
            : t('storage.usedNoLimit', { used: formatFileSize(usedBytes) })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-md:px-0">
        {/* Usage bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('storage.used')}</span>
            <span className="font-medium">
              {hasLimit ? t('common:units.percent', { value: pct }) : formatFileSize(usedBytes)}
            </span>
          </div>
          {hasLimit && <Progress value={pct} indicatorClassName={storageBarColor(pct)} />}
          {hasLimit && storage.remainingBytes !== null && (
            <p className="text-xs text-muted-foreground">
              {t('storage.remaining', { size: formatFileSize(storage.remainingBytes) })}
            </p>
          )}
        </div>

        {/* Per-category breakdown */}
        {categories.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {categories.map((c) => {
              const entry = storage.byCategory![c];
              const Icon = CATEGORY_ICONS[c];
              return (
                <div key={c} className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    {t(`storage.categories.${c}` as const)}
                  </div>
                  <p className="mt-1 font-semibold">{formatFileSize(entry.bytes)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('storage.files', { count: entry.count })}
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
              {pct >= 100 ? t('storage.full') : t('storage.nearFull', { percent: pct })}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/media')}>
                {t('storage.freeUpSpace')}
              </Button>
              {onViewPlans && (
                <Button size="sm" onClick={onViewPlans}>
                  {t('storage.upgradePlan')}
                </Button>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">{t('storage.footnote')}</p>
      </CardContent>
    </Card>
  );
}
