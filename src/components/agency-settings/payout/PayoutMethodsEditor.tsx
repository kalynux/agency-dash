import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Pencil, Plus, Star, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PaymentMethodMark } from '@/components/common/PaymentBrandLogo';
import { MAX_PAYOUT_METHODS } from '@/onboarding/schemas/onboarding.schemas';
import { PayoutMethodDialog } from './PayoutMethodDialog';
import {
  isPayoutEntryComplete,
  payoutEntryDetail,
  payoutEntryMark,
  payoutEntryTitle,
  type PayoutEntry,
} from './payoutEntry.helpers';

export interface PayoutMethodsEditorProps {
  /** The ordered payout array — index 0 is the preferred method. */
  value: PayoutEntry[];
  onChange: (next: PayoutEntry[]) => void;
}

/**
 * The payout destinations, as a list of saved methods plus one dialog — the same
 * shape Billing → Payment methods uses, so "how I pay" and "how I get paid" are
 * read and edited the same way.
 *
 * Purely local: it edits the array it is handed and lets the surrounding surface
 * decide when that reaches the API. `payout_details` is a full replace, so a
 * per-row write would be a lie.
 */
export function PayoutMethodsEditor({ value, onChange }: PayoutMethodsEditorProps) {
  const { t } = useTranslation(['account', 'common']);
  const [dialogOpen, setDialogOpen] = useState(false);
  /** Index being edited, or `null` while adding. */
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  // Bumped on every open so the dialog remounts against the row it was opened
  // for. Closing leaves it alone, which is what lets the sheet animate out.
  const [dialogSession, setDialogSession] = useState(0);

  const atLimit = value.length >= MAX_PAYOUT_METHODS;
  const editing = editIndex === null ? null : (value[editIndex] ?? null);
  const removeTarget = removeIndex === null ? null : (value[removeIndex] ?? null);

  function openAdd() {
    setEditIndex(null);
    setDialogSession((n) => n + 1);
    setDialogOpen(true);
  }

  function openEdit(index: number) {
    setEditIndex(index);
    setDialogSession((n) => n + 1);
    setDialogOpen(true);
  }

  function handleSave(entry: PayoutEntry, makePreferred: boolean) {
    const next = [...value];
    if (editIndex === null) {
      if (makePreferred) next.unshift(entry);
      else next.push(entry);
    } else {
      next[editIndex] = entry;
      if (makePreferred && editIndex > 0) {
        next.splice(editIndex, 1);
        next.unshift(entry);
      }
    }
    onChange(next);
  }

  function promote(index: number) {
    const next = [...value];
    const [entry] = next.splice(index, 1);
    next.unshift(entry);
    onChange(next);
  }

  function confirmRemove() {
    if (removeIndex === null) return;
    onChange(value.filter((_, i) => i !== removeIndex));
    setRemoveIndex(null);
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t('payout.empty')}
        </p>
      ) : (
        <ul className="divide-y">
          {value.map((entry, index) => {
            const isPreferred = index === 0;
            const complete = isPayoutEntryComplete(entry);
            const label = payoutEntryTitle(entry, t);
            const detail = payoutEntryDetail(entry);
            return (
              <li key={index} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                {/* The destination is spelled out beside it, so the mark is decorative. */}
                <PaymentMethodMark {...payoutEntryMark(entry)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-medium">{label}</span>
                    {isPreferred && <Badge variant="secondary">{t('payout.preferred')}</Badge>}
                    {!complete && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" aria-hidden="true" />
                        {t('payout.incomplete')}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {detail || t('payout.incompleteHint')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {!isPreferred && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 gap-1.5 px-2.5 max-sm:w-11 max-sm:px-0"
                      onClick={() => promote(index)}
                      aria-label={t('payout.setPreferredAria', { label })}
                    >
                      <Star className="h-4 w-4" />
                      <span className="max-sm:hidden">{t('payout.setPreferred')}</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-11 p-0"
                    onClick={() => openEdit(index)}
                    aria-label={t('payout.editAria', { label })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-11 p-0 text-muted-foreground hover:text-destructive"
                    // The schema demands at least one method, so the last row
                    // stays put rather than failing the save it would cause.
                    disabled={value.length <= 1}
                    title={value.length <= 1 ? t('payout.keepOne') : undefined}
                    onClick={() => setRemoveIndex(index)}
                    aria-label={t('payout.removeAria', { label })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={openAdd}
        disabled={atLimit}
        title={atLimit ? t('payout.atLimit', { max: MAX_PAYOUT_METHODS }) : undefined}
        className="w-full gap-1.5 border-dashed"
      >
        <Plus className="h-4 w-4" />
        {t('payout.addMethod')}
      </Button>

      <PayoutMethodDialog
        key={dialogSession}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editing}
        // The switch would be a no-op for the first method ever added, and for
        // the one already sitting at the front of the list.
        forcePreferred={value.length === 0 || editIndex === 0}
        onSave={handleSave}
      />

      <AlertDialog open={removeIndex !== null} onOpenChange={(open) => !open && setRemoveIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('payout.removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('payout.removeDescription', {
                label: removeTarget ? payoutEntryTitle(removeTarget, t) : '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common:actions.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
