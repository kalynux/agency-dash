import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AddressRegionRefusal } from '@/lib/addressRegion';

export interface AddressRegionRepairProps {
  refusal: AddressRegionRefusal;
  /** "Save" in Settings, "Continue" in onboarding — whatever resends the list. */
  actionLabel: string;
  pending: boolean;
  /** Set the entry's `geo.components.region` to `key` and resend the whole list. */
  onApply: (key: string) => void;
}

/**
 * The repair for `400 ADDRESS_REGION_INVALID`, shown inside the refused
 * headquarters entry: why it was refused, a picker built from the error's own
 * `allowedRegions`, and one button that applies the pick and resends.
 */
export function AddressRegionRepair({ refusal, actionLabel, pending, onApply }: AddressRegionRepairProps) {
  const { t } = useTranslation('common');
  const [picked, setPicked] = useState('');
  const read = refusal.region ?? refusal.city;

  return (
    <div
      role="alert"
      className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <p className="flex items-start gap-2 text-sm font-medium">
        <MapPinOff className="mt-0.5 h-4 w-4 shrink-0" />
        {read ? t('addressRegion.titleWithPlace', { place: read }) : t('addressRegion.title')}
      </p>
      <p className="text-xs">{t('addressRegion.explainer')}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={picked} onValueChange={setPicked}>
          <SelectTrigger className="bg-background text-foreground sm:flex-1" aria-label={t('addressRegion.pickLabel')}>
            <SelectValue placeholder={t('addressRegion.pickPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {refusal.allowedRegions.map((r) => (
              <SelectItem key={r.key} value={r.key}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" disabled={!picked || pending} onClick={() => onApply(picked)}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : actionLabel}
        </Button>
      </div>
    </div>
  );
}
