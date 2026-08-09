import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { SectionHeading } from '@/components/common/InfoHint';
import { UnsavedChangesBar } from '@/components/agency-settings/UnsavedChangesBar';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { PayoutMethodsEditor, toPayoutEntries, type PayoutEntry } from '@/components/agency-settings/payout';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { buildPayoutSchema, toSubmittablePayoutDetails } from '@/onboarding/schemas/onboarding.schemas';
import { getApiErrorMessage } from '@/lib/errors';
import { isSameFormValue } from '@/lib/form-diff';

export function PayoutSettings() {
  const { t } = useTranslation('account');
  const { session, updateAgencyProfile, isSubmitting } = useOnboarding();
  const roleEntity = session?.role_entity;
  const [apiError, setApiError] = useState<string | null>(null);

  /**
   * The last values the server is known to hold — the list's seed and the
   * yardstick the unsaved-changes bar measures against. Advanced only on a
   * successful save: re-deriving it from `session` would let an unrelated
   * session refresh wipe an edit in progress.
   */
  const [baseline, setBaseline] = useState<PayoutEntry[]>(() =>
    toPayoutEntries(roleEntity?.payout_details),
  );
  const [entries, setEntries] = useState<PayoutEntry[]>(baseline);

  const schema = useMemo(() => buildPayoutSchema(t), [t]);
  const dirty = !isSameFormValue(entries, baseline);

  const handleSave = useCallback(async () => {
    setApiError(null);
    // The schema is also the sanitizer: it trims, coerces the card's expiry to
    // numbers and strips the display-only mask a seeded row carries, so what is
    // sent is exactly the documented shape.
    const parsed = schema.safeParse({ payout_details: entries });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t('payout.incompleteSave'));
      return;
    }
    try {
      // Mobile-money numbers go out as E.164, including ones seeded from a legacy
      // row the user never touched (see toSubmittablePayoutDetails).
      const payout_details = toSubmittablePayoutDetails(parsed.data.payout_details);
      await updateAgencyProfile({ payout_details });
      // Re-seed from the values the server accepted — they are normalized, so the
      // bar settles instead of hanging on a number we just rewrote.
      setEntries(payout_details);
      setBaseline(payout_details);
      toast.success(t('payout.saved'));
    } catch (err) {
      setApiError(getApiErrorMessage(err));
    }
  }, [entries, schema, updateAgencyProfile, t]);

  const handleDiscard = useCallback(() => {
    setEntries(baseline);
    setApiError(null);
  }, [baseline]);

  return (
    <>
      <Card className={sectionSurfaceClass}>
        <SectionHeading
          title={t('payout.title')}
          description={t('payout.description')}
          short={t('payout.short')}
        />
        <CardContent className="space-y-4 max-md:px-0">
          {apiError && (
            <div role="alert" className="p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-200">
              {apiError}
            </div>
          )}
          <PayoutMethodsEditor value={entries} onChange={setEntries} />
        </CardContent>
      </Card>

      <UnsavedChangesBar
        visible={dirty || isSubmitting}
        saving={isSubmitting}
        onDiscard={handleDiscard}
        onSave={() => void handleSave()}
      />
    </>
  );
}
