/**
 * This SKU's storage rent, per month.
 *
 * THE SAME BASIS THE MONTHLY STATEMENT BILLS — the rate × the COUNTED shelf —
 * but live, while the statement freezes the shelf on the 1st. So "billed monthly
 * on this basis" is true, and "due", "overdue" or "outstanding" never are: the
 * statement is the record, and no money moves on either.
 *
 * AN UNCOUNTED SHELF QUOTES 0 (`quantityBasis: "uncounted"`). That 0 means
 * "nobody has counted", not "nothing is owed", so it is never printed as an
 * amount — the panel says the shelf is not counted yet instead.
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
import { ChevronDown, Ruler, Wallet } from 'lucide-react';
import { InfoHint } from '@/components/common/InfoHint';
import { formatCurrency, formatNumber } from '@/lib/format';
import { describeDimensions, describeVolume } from '@/types/inventory.types';
import type { InventoryStorageFee } from '@/types/inventory.types';

export function StorageFeePanel({ fee }: { fee: InventoryStorageFee }) {
  const { t } = useTranslation('inventory');

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('storageFee.title')}
        {/* How the figure is billed is help, not content: behind the ⓘ at every
            width, so the panel itself is the amount and how it was reached. */}
        {fee.storageBasedEnabled && (
          <InfoHint title={t('storageFee.title')}>
            <span className="block">{t('storageFee.billedCaption')}</span>
            {fee.size && <span className="mt-2 block">{t('storageFee.sizeCaption')}</span>}
          </InfoHint>
        )}
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
            {fee.quantityBasis === 'uncounted' ? (
              // A 0 that means "nobody has counted" — said in words, never as an amount.
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('storageFee.uncounted')}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('storageFee.uncountedHint', { rate: formatCurrency(fee.monthlyRatePerSku) })}
                </p>
              </div>
            ) : (
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
            )}
          </div>

          <SizeLine size={fee.size} />
        </div>
      )}
    </section>
  );
}

/**
 * Dimensions, for sanity-checking the rate — folded away by default, because
 * they are not part of the calculation and most visits are not about them.
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
    <details className="group mt-2 border-t pt-2">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <Ruler className="h-3 w-3 flex-shrink-0" />
        {t('storageFee.sizeTitle')}
        <ChevronDown className="ms-auto h-3.5 w-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        <SizeRow label={t('storageFee.dimensions')} value={dimensions} />
        <SizeRow label={t('storageFee.volume')} value={volume} />
        <SizeRow
          label={t('storageFee.weight')}
          value={size.weightG == null ? null : t('storageFee.weightValue', { grams: formatNumber(size.weightG) })}
        />
        <SizeRow label={t('storageFee.sizeSource')} value={t(`storageFee.sources.${size.source}`)} />
      </dl>
    </details>
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
