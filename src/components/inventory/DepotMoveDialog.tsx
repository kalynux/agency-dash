/**
 * Re-point a stored product at another of our depots.
 *
 * KEYED ON THE PRODUCT, not the row: the depot lives on
 * `product.delivery.pickup_location`, so the move is per product by construction
 * and every active variant moves together. `affectedRows` reports how many did.
 *
 * APPLIES IMMEDIATELY, with no vendor confirmation — which of OUR buildings holds
 * the goods is our record to state. The warning below is not boilerplate: the
 * depot address resolves live on every read, so re-pointing a product also
 * redirects collection for shipments already in flight. That is the intended
 * behaviour (it is what makes a corrected typo fix every in-flight shipment), but
 * an agency must not discover it afterwards.
 *
 * See api-doc/agency/inventory.md §4.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { inventoryService } from '@/services/inventory.service';
import { useMagazin } from '@/store/magazin.store';
import { getApiErrorMessage } from '@/lib/errors';
import { buildDepotOptions } from '@/components/inventory/depot-options';
import type { InventoryDetail } from '@/types/inventory.types';

/**
 * The sentinel for `locationId: null`.
 *
 * `null` is a real answer, not a missing one — it means "track my primary depot",
 * so the product follows `headquartersAddresses[0]` and keeps following it if the
 * depots are later reordered. A radio group cannot hold `null`, hence the
 * sentinel, which is mapped back at submit.
 */
const FOLLOW_PRIMARY = '__primary__';

export function DepotMoveDialog({
  detail,
  open,
  onOpenChange,
  onMoved,
}: {
  detail: InventoryDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoved: () => void;
}) {
  const { t } = useTranslation(['inventory', 'common']);
  const { data: magazin } = useMagazin();
  const [selected, setSelected] = useState<string>(detail.location?.id ?? FOLLOW_PRIMARY);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = buildDepotOptions(magazin?.headquartersAddresses ?? [], {
    primary: t('filters.primaryLocation'),
    branch: (number) => t('filters.branch', { number }),
  });

  const submit = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const { data } = await inventoryService.moveDepot(detail.productId, {
        locationId: selected === FOLLOW_PRIMARY ? null : selected,
      });
      onOpenChange(false);
      onMoved();
      // `affectedRows` is worth surfacing: moving one row visibly moved three is
      // surprising unless you know the depot is named once on the product.
      if (data?.affectedRows != null) {
        toast.success(
          t('depot.movedToast', {
            count: data.affectedRows,
            location: data.locationLabel ?? t('depot.followPrimaryShort'),
          }),
        );
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('depot.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('depot.dialogBody')}</DialogDescription>
        </DialogHeader>

        <RadioGroup value={selected} onValueChange={setSelected} className="gap-2">
          {/* Offered first and named explicitly, because "no depot" and "follow
              whichever depot is primary" are different statements and every
              product written before the picker existed is in the second state. */}
          <label
            htmlFor="depot-primary"
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
          >
            <RadioGroupItem value={FOLLOW_PRIMARY} id="depot-primary" className="mt-0.5" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{t('depot.followPrimary')}</span>
              <span className="block text-xs text-muted-foreground">
                {t('depot.followPrimaryHint')}
              </span>
            </span>
          </label>

          {options.map((option) => (
            <label
              key={option.value}
              htmlFor={`depot-${option.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <RadioGroupItem value={option.value} id={`depot-${option.value}`} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{option.label}</span>
                {option.isPrimary && (
                  <span className="block text-xs text-muted-foreground">
                    {t('filters.primaryLocation')}
                  </span>
                )}
              </span>
            </label>
          ))}
        </RadioGroup>

        {/* Stated BEFORE the confirm button, not after the fact. */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <p>{t('depot.inFlightWarning')}</p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            {t('common:actions.cancel')}
          </Button>
          <Button onClick={submit} disabled={isBusy} className="gap-1.5">
            {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('depot.confirmMove')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
