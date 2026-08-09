/**
 * What this SKU should be costing in storage rent, per month.
 *
 * A DISPLAY FIGURE AND NOTHING ELSE. The platform does not track storage payment,
 * does not invoice it, and never acts on it — collection is out-of-band, and the
 * only platform lever attached to it is the agency's own manual suspension. None
 * of the copy here may say "due", "overdue", "outstanding", "invoice" or "paid".
 *
 * THE RATE IS FLAT, PER SKU, PER MONTH. `monthlyEstimate = monthlyRatePerSku ×
 * quantity`. Size is rendered beside it so the agency can sanity-check that rate
 * against what it is actually shelving — a pallet and an envelope cost the same
 * today, and seeing that is what prompts an out-of-band renegotiation. **Nothing
 * here multiplies by size.**
 *
 * See api-doc/agency/inventory.md §1b.
 */

import { useTranslation } from 'react-i18next';
import { Ruler, Wallet } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/format';
import { describeDimensions, describeVolume } from '@/types/inventory.types';
import type { InventoryStorageFee } from '@/types/inventory.types';

export function StorageFeePanel({ fee }: { fee: InventoryStorageFee }) {
  const { t } = useTranslation('inventory');

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('storageFee.title')}
      </h3>

      {/* Not a rate of zero — an agency that does not warehouse at all. Showing
          "0 XAF/month" would read as free storage rather than no offer. */}
      {!fee.storageBasedEnabled ? (
        <div className="rounded-lg border border-dashed p-3">
          <p className="text-sm font-medium">{t('storageFee.notOffered')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('storageFee.notOfferedHint')}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-3">
          <div className="flex items-start gap-2">
            <Wallet className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="font-numeric text-lg font-bold tracking-tight">
                {t('storageFee.monthlyEstimate', {
                  amount: formatCurrency(fee.monthlyEstimate),
                })}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('storageFee.breakdown', {
                  rate: formatCurrency(fee.monthlyRatePerSku),
                  quantity: formatNumber(fee.quantity),
                })}
              </p>
            </div>
          </div>

          <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
            {t('storageFee.notBilledCaption')}
          </p>

          <SizeLine size={fee.size} />
        </div>
      )}
    </section>
  );
}

/**
 * Dimensions, for sanity-checking the rate.
 *
 * `volumeCm3` is null unless all three dimensions are known, and it renders as an
 * em dash — never `0`, because a zero reads as a claim that the item has no
 * volume, which is a different statement from "we were not told".
 */
function SizeLine({ size }: { size: InventoryStorageFee['size'] }) {
  const { t } = useTranslation('inventory');
  if (!size) return null;

  const dimensions = describeDimensions(size);
  const volume = describeVolume(size);
  if (!dimensions && volume == null && size.weightG == null) return null;

  return (
    <div className="mt-2 border-t pt-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Ruler className="h-3 w-3 flex-shrink-0" />
        {t('storageFee.sizeTitle')}
      </p>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        <SizeRow label={t('storageFee.dimensions')} value={dimensions} />
        <SizeRow label={t('storageFee.volume')} value={volume} />
        <SizeRow
          label={t('storageFee.weight')}
          value={size.weightG == null ? null : t('storageFee.weightValue', { grams: formatNumber(size.weightG) })}
        />
        <SizeRow label={t('storageFee.sizeSource')} value={t(`storageFee.sources.${size.source}`)} />
      </dl>
      <p className="mt-1.5 text-xs text-muted-foreground/80">{t('storageFee.sizeCaption')}</p>
    </div>
  );
}

function SizeRow({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-numeric">{value ?? '—'}</dd>
    </>
  );
}
