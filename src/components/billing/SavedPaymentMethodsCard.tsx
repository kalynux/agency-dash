import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Star, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { InfoHint } from '@/components/common/InfoHint';
import { sectionRuleClass, sectionSurfaceClass } from '@/components/layout/PageContainer';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import type { SavedPaymentMethod } from '@/types/payment-method.types';
import {
  fetchPaymentMethods,
  setDefaultPaymentMethod,
  deletePaymentMethod,
} from '@/services/payment-methods.service';
import { CardSkeleton } from './BillingSkeletons';
import { billingErrorMessage, methodTypeLabel } from './billing.constants';
import { AddPaymentMethodDialog } from './AddPaymentMethodDialog';
import { ManageOnWebNotice } from './ManageOnWebNotice';
import { purchasesEnabled } from '@/platform/purchases';

const MAX_METHODS = 10;

/**
 * Saved payment methods.
 *
 * Read-only inside the native shell (CAPACITOR-PLAN.md → Phase 5, decision D4).
 * The list, the default badge, "set as default" and "remove" all stay: those
 * manage an instrument that already exists, and being unable to delete a card
 * from the device in your hand would be a worse app, not a safer one.
 *
 * Adding one does not stay. A card form in an app that cannot complete a
 * purchase is a question a store reviewer will ask, and the only answer is
 * "so you can pay on the web" — which is the answer the notice gives directly,
 * without collecting a card number first.
 */
export function SavedPaymentMethodsCard() {
  const { t } = useTranslation(['billing', 'common']);
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDefaultId, setPendingDefaultId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedPaymentMethod | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMethods(await fetchPaymentMethods());
    } catch (err) {
      setError(billingErrorMessage(err, t('methods.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSetDefault(id: string) {
    setPendingDefaultId(id);
    try {
      await setDefaultPaymentMethod(id);
      setMethods((prev) => prev.map((m) => ({ ...m, is_default: m.id === id })));
    } catch (err) {
      toast.error(billingErrorMessage(err, t('methods.setDefaultFailed')));
    } finally {
      setPendingDefaultId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const wasDefault = deleteTarget.is_default;
    setDeleting(true);
    try {
      await deletePaymentMethod(deleteTarget.id);
      const remaining = methods.filter((m) => m.id !== deleteTarget.id);
      setMethods(remaining);
      toast.success(t('methods.removed'));
      // Deleting the default does not auto-promote another (per the API docs).
      if (wasDefault && remaining.length > 0) {
        toast.info(t('methods.pickNewDefault'));
      }
    } catch (err) {
      toast.error(billingErrorMessage(err, t('methods.removeFailed')));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const atLimit = methods.length >= MAX_METHODS;

  return (
    <Card className={cn(sectionSurfaceClass, sectionRuleClass)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 max-md:px-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            {t('methods.title')}
            <InfoHint className="md:hidden" label={t('methods.aboutLabel')}>
              {t('methods.description')}
            </InfoHint>
          </CardTitle>
          <CardDescription className="max-md:hidden">{t('methods.description')}</CardDescription>
          <CardDescription className="md:hidden">{t('methods.descriptionShort')}</CardDescription>
        </div>
        {purchasesEnabled && (
          <Button
            size="sm"
            className="gap-1"
            onClick={() => setAddOpen(true)}
            disabled={atLimit}
            title={atLimit ? t('methods.atLimit', { count: MAX_METHODS }) : undefined}
          >
            <Plus className="h-4 w-4" /> {t('common:actions.add')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="max-md:px-0">
        {loading ? (
          <CardSkeleton lines={3} />
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              {t('common:actions.retry')}
            </Button>
          </div>
        ) : methods.length === 0 && !purchasesEnabled ? (
          // The gated empty state would otherwise be a dead end: nothing saved,
          // and no button to say what to do about it.
          <ManageOnWebNotice kind="method" />
        ) : methods.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('methods.empty')}</p>
        ) : (
          <ul className="divide-y">
            {methods.map((m) => (
              <li key={m.id} className="flex min-h-14 items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <PaymentMethodMark brand={m.brand} methodType={m.method_type} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-medium">{m.display_label}</span>
                    {m.is_default && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                        {t('methods.default')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {methodTypeLabel(m.method_type)}
                    {m.method_type === 'card' && m.exp_month && m.exp_year
                      ? ` · ${t('methods.expires', {
                          month: String(m.exp_month).padStart(2, '0'),
                          year: String(m.exp_year).slice(-2),
                        })}`
                      : ''}
                  </p>
                </div>
                {/* Both actions clear the 44px touch minimum; only the label folds away. */}
                <div className="flex shrink-0 items-center gap-0.5">
                  {!m.is_default && (
                    <Button
                      variant="ghost"
                      className="h-11 gap-1.5 px-2.5 max-sm:w-11 max-sm:px-0"
                      onClick={() => handleSetDefault(m.id)}
                      disabled={pendingDefaultId === m.id}
                      aria-label={t('methods.setDefault')}
                    >
                      {pendingDefaultId === m.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}
                      <span className="max-sm:hidden">{t('methods.setDefault')}</span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="h-11 w-11 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(m)}
                    aria-label={t('methods.remove')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {/* Where the Add button went. Only under a non-empty list — the empty
            state above already carries the same notice instead of its copy. */}
        {!purchasesEnabled && !loading && !error && methods.length > 0 && (
          <ManageOnWebNotice kind="method" className="mt-4" />
        )}
      </CardContent>

      {purchasesEnabled && (
        <AddPaymentMethodDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          forceDefault={methods.length === 0}
          onAdded={(created) => {
            // A new default clears the previous one locally; first method is always default.
            setMethods((prev) =>
              created.is_default
                ? [created, ...prev.map((m) => ({ ...m, is_default: false }))]
                : [...prev, created],
            );
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('methods.removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('methods.removeDescription', { label: deleteTarget?.display_label ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common:actions.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
