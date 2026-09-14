// Account → Verification — the agency's identity verification (KYC) record.
//
// `/api/agency/kyc`, see api-doc/agency/identity-verification.md.
//
// Three things about this screen are easy to get wrong:
//
// 1. **`status: "pending"` does not mean "waiting for review".** It is the
//    schema default, so it also means "never touched". `submittedAt` separates
//    the two — every branch here reads `kycPhase()`, never `status`.
// 2. **Nothing is required by the API.** An empty record submits successfully.
//    The completeness rules are the REVIEWERS' policy (`kyc-checklist.ts`); this
//    screen implements them as guidance and lets the agency submit anyway, which
//    is the whole point — a human then tells them what is missing, by name.
// 3. **`idNumber` is the PERSON's national identity number**, not the company
//    registration. `registration_number` / `transport_license_id` are a
//    different pair of fields on a different endpoint (`PATCH /agency/profile`).
//
// Verification is NOT an onboarding step: it can be submitted at any time and it
// gates nothing in this dashboard.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  FileCheck2,
  Loader2,
  Lock,
  ShieldCheck,
  Send,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { useResource } from '@/hooks/useResource';
import { useMagazin } from '@/store/magazin.store';
import { agencyProfileService } from '@/services/agency-profile.service';
import {
  KYC_DEFAULT_MULTI_SLOT_MAX,
  KYC_DOCUMENT_SLOTS,
  KYC_MAX_FILE_MB,
  filesInSlot,
  homeAddressForDisplay,
  kycPhase,
  kycService,
} from '@/services/kyc.service';
import {
  buildKycChecklist,
  outstandingRequirements,
  type KycChecklistItem,
  type KycChecklistKey,
} from './kyc-checklist';
import { getApiErrorMessage, getErrorCode } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { GeoAddress } from '@/types/geo.types';
import type { KycDocumentSlot, KycRecord, KycUpdatePayload } from '@/types/kyc.types';

import { LoadingState, ErrorState } from '@/components/common/state-views';
import { AddressSearchInput } from '@/components/common/AddressSearchInput';
import { SectionHeading } from '@/components/common/InfoHint';
import { UnsavedChangesBar } from '@/components/agency-settings/UnsavedChangesBar';
import { KycDocumentSlotCard } from './KycDocumentSlotCard';
import { sectionGroupClass, sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

/** The backend's own ceiling on `idNumber`; over it is a `VALIDATION_ERROR`. */
const ID_NUMBER_MAX_LENGTH = 64;

/**
 * The home address field's three states.
 *
 * ⚠ This is a discriminated union rather than a plain `GeoAddress | null`
 * because the READ shape and the WRITE shape of this field are different, and
 * converting one back into the other is the mistake the backend's `geocoded`
 * badge exists to catch. A stored address is displayed from
 * `homeAddressForDisplay` and never sent back; only a candidate the user picked
 * in THIS session (`picked`) is ever PATCHed.
 */
type HomeAddressField =
  | { kind: 'stored' }
  | { kind: 'picked'; value: GeoAddress }
  | { kind: 'cleared' };

interface FormState {
  idNumber: string;
  home: HomeAddressField;
}

function toForm(record: KycRecord): FormState {
  return { idNumber: record.idNumber ?? '', home: { kind: 'stored' } };
}

/**
 * Only what changed. Both fields are clearable: `""`/`null` removes the stored
 * value, an omitted key leaves it alone.
 */
function buildPayload(form: FormState, record: KycRecord): KycUpdatePayload {
  const payload: KycUpdatePayload = {};

  const id = form.idNumber.trim();
  if (id !== (record.idNumber ?? '')) payload.idNumber = id || null;

  if (form.home.kind === 'picked') payload.homeAddress = form.home.value;
  else if (form.home.kind === 'cleared' && record.homeAddress) payload.homeAddress = null;

  return payload;
}

export function VerificationSettings() {
  const { t } = useTranslation(['account', 'common']);

  const {
    data: record,
    isLoading,
    error,
    refetch,
    setData,
  } = useResource(() => kycService.getRecord(), []);

  // The magazin is already in memory for the whole session (sidebar identity,
  // Account → Store), so reading depots from it costs nothing. It is what
  // decides whether the reviewers will ask for a home address at all.
  const { data: magazin } = useMagazin();

  // The set-once operating country, purely as the geocoder's search bias.
  const { data: country } = useResource(
    () => agencyProfileService.getProfile().then((r) => r.data.country),
    [],
  );

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => {
    if (record) {
      setForm(toForm(record));
      setSaveError(null);
    }
  }, [record]);

  /**
   * A write refused with `409 KYC_LOCKED` means a reviewer moved the record
   * while this screen was open. Re-reading is the only useful response: the form
   * is showing `locked: false` for a record that is no longer editable, and
   * every further keystroke leads to the same 409.
   */
  const handleWriteError = useCallback(
    (err: unknown): string => {
      const message = getApiErrorMessage(err);
      if (getErrorCode(err) === 'KYC_LOCKED') void refetch();
      return message;
    },
    [refetch],
  );

  const dirty = useMemo(
    () => (record && form ? Object.keys(buildPayload(form, record)).length > 0 : false),
    [record, form],
  );

  const handleDiscard = useCallback(() => {
    if (record) {
      setForm(toForm(record));
      setSaveError(null);
    }
  }, [record]);

  const handleSave = useCallback(async () => {
    if (!record || !form) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await kycService.updateRecord(buildPayload(form, record));
      setData(updated);
      toast.success(t('verification.saved'));
    } catch (err) {
      setSaveError(handleWriteError(err));
    } finally {
      setSaving(false);
    }
  }, [record, form, setData, t, handleWriteError]);

  const handleUpload = useCallback(
    async (slot: KycDocumentSlot, files: File[]) => {
      try {
        setData(await kycService.uploadDocuments(slot, files));
        toast.success(t('verification.upload.succeeded', { count: files.length }));
      } catch (err) {
        toast.error(handleWriteError(err));
      }
    },
    [setData, t, handleWriteError],
  );

  const handleDeleteDocument = useCallback(
    async (slot: KycDocumentSlot, fileId: string) => {
      try {
        setData(await kycService.deleteDocument(slot, fileId));
        toast.success(t('verification.upload.removed'));
      } catch (err) {
        toast.error(handleWriteError(err));
      }
    },
    [setData, t, handleWriteError],
  );

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      setData(await kycService.submit());
      toast.success(t('verification.submit.succeeded'));
    } catch (err) {
      toast.error(handleWriteError(err));
    } finally {
      setSubmitting(false);
      setConfirmSubmit(false);
    }
  }, [setData, t, handleWriteError]);

  // `null` until the magazin resolves — see `buildKycChecklist`, which asks for
  // both conditional branches rather than guessing which one applies.
  const hasDepot = magazin ? magazin.headquartersAddresses.length > 0 : null;
  const depotsGeocoded =
    !!magazin &&
    magazin.headquartersAddresses.length > 0 &&
    magazin.headquartersAddresses.every((d) => !!d.geo);

  const checklist = useMemo(
    () => (record ? buildKycChecklist({ record, hasDepot, depotsGeocoded }) : []),
    [record, hasDepot, depotsGeocoded],
  );
  const outstanding = useMemo(() => outstandingRequirements(checklist), [checklist]);

  if (isLoading && !record) return <LoadingState label={t('verification.loading')} />;
  if (error && !record) return <ErrorState error={error} onRetry={refetch} />;
  if (!record || !form) return null;

  const phase = kycPhase(record);
  const locked = record.locked;
  const multiSlotMax = record.limits?.multiSlotMaxFiles ?? KYC_DEFAULT_MULTI_SLOT_MAX;
  const geoBias = (country ?? '').toLowerCase() || undefined;

  // Display only — see `homeAddressForDisplay`. A picked candidate wins because
  // it is what Save would send; `cleared` shows nothing.
  const shownAddress: GeoAddress | null =
    form.home.kind === 'picked'
      ? form.home.value
      : form.home.kind === 'cleared'
        ? null
        : record.homeAddress
          ? homeAddressForDisplay(record.homeAddress)
          : null;

  const byKey = new Map(checklist.map((item) => [item.key, item]));
  const slotRequirement = (key: KycChecklistKey) => byKey.get(key);

  return (
    <div className={sectionGroupClass}>
      {saveError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {saveError}
        </div>
      )}

      {/* ─── Verdict ──────────────────────────────────────────────────────── */}
      <Card className={sectionSurfaceClass}>
        <SectionHeading
          icon={ShieldCheck}
          title={t('verification.status.title')}
          description={t('verification.status.description')}
          short={t('verification.status.short')}
          action={<PhaseBadge phase={phase} />}
        />
        <CardContent className="space-y-3 max-md:px-0">
          <p className="text-sm text-muted-foreground">
            {/*
              A rejected record with no reason on it is the documented shape of a
              RESUBMISSION: submitting again clears `rejectionReason` and
              re-stamps `submittedAt`, but the verdict stays `rejected` until an
              administrator moves it. So the badge keeps saying "Rejected" —
              that is still the standing verdict, and claiming otherwise would be
              inventing one — while the copy stops telling the agency to read a
              reason that is no longer there.
            */}
            {t(
              (phase === 'rejected' && !record.rejectionReason
                ? 'verification.status.rejectedResubmitted'
                : `verification.status.${phase}`) as never,
            )}
          </p>

          {phase === 'rejected' && record.rejectionReason && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-destructive">
                {t('verification.status.rejectionReason')}
              </p>
              <p className="mt-1 text-sm text-destructive">{record.rejectionReason}</p>
            </div>
          )}

          <dl className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            {record.submittedAt && (
              <div className="flex gap-1.5">
                <dt className="font-medium">{t('verification.status.submittedAt')}</dt>
                <dd>{formatDateTime(record.submittedAt)}</dd>
              </div>
            )}
            {record.verifiedAt && (
              <div className="flex gap-1.5">
                <dt className="font-medium">{t('verification.status.verifiedAt')}</dt>
                <dd>{formatDateTime(record.verifiedAt)}</dd>
              </div>
            )}
          </dl>

          {locked && (
            <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t(
                phase === 'verified'
                  ? 'verification.status.lockedVerified'
                  : 'verification.status.lockedUnderReview',
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── What the reviewers check ─────────────────────────────────────── */}
      <Card className={sectionSurfaceClass}>
        <SectionHeading
          icon={FileCheck2}
          title={t('verification.checklist.title')}
          description={t('verification.checklist.description')}
          short={t('verification.checklist.short')}
        />
        <CardContent className="space-y-3 max-md:px-0">
          <ul className="space-y-2">
            {checklist.map((item) => (
              <ChecklistRow key={item.key} item={item} />
            ))}
          </ul>
          {hasDepot === true && !depotsGeocoded && (
            <p className="text-xs text-muted-foreground">
              {t('verification.checklist.depotNotPinned')}{' '}
              <Link
                to="/dashboard/account/locations"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {t('verification.checklist.depotNotPinnedAction')}
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── The typed half ───────────────────────────────────────────────── */}
      <Card className={sectionSurfaceClass}>
        <SectionHeading
          title={t('verification.identity.title')}
          description={t('verification.identity.description')}
          short={t('verification.identity.short')}
        />
        <CardContent className="space-y-6 max-md:px-0">
          <div className="space-y-2">
            <Label htmlFor="kyc-id-number">{t('verification.identity.idNumber')}</Label>
            <Input
              id="kyc-id-number"
              value={form.idNumber}
              disabled={locked}
              maxLength={ID_NUMBER_MAX_LENGTH}
              placeholder={t('verification.identity.idNumberPlaceholder')}
              onChange={(e) =>
                setForm((prev) => (prev ? { ...prev, idNumber: e.target.value } : prev))
              }
            />
            <p className="text-xs text-muted-foreground">
              {t('verification.identity.idNumberHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kyc-home-address">{t('verification.identity.homeAddress')}</Label>
            {locked ? (
              <div className="rounded-lg border px-3 py-2 text-sm">
                {shownAddress?.formatted_address ?? t('common:values.notAvailable')}
              </div>
            ) : (
              <AddressSearchInput
                id="kyc-home-address"
                value={shownAddress}
                country={geoBias}
                placeholder={t('verification.identity.homeAddressPlaceholder')}
                onSelect={(address) =>
                  setForm((prev) => (prev ? { ...prev, home: { kind: 'picked', value: address } } : prev))
                }
                onClear={() =>
                  setForm((prev) => (prev ? { ...prev, home: { kind: 'cleared' } } : prev))
                }
              />
            )}
            <p className="text-xs text-muted-foreground">
              {/* Unknown reads as "required": over-asking is the harmless side. */}
              {t(
                hasDepot === true
                  ? 'verification.identity.homeAddressOptionalHint'
                  : 'verification.identity.homeAddressRequiredHint',
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Documents ────────────────────────────────────────────────────── */}
      <Card className={sectionSurfaceClass}>
        <SectionHeading
          title={t('verification.documents.title')}
          description={t('verification.documents.description')}
          short={t('verification.documents.short')}
        />
        <CardContent className="space-y-4 max-md:px-0">
          <p className="text-xs text-muted-foreground">
            {t('verification.documents.fileRules', { mb: KYC_MAX_FILE_MB })}
          </p>

          {KYC_DOCUMENT_SLOTS.map((slot) => {
            const item = slotRequirement(SLOT_CHECKLIST_KEY[slot]);
            return (
              <KycDocumentSlotCard
                key={slot}
                slot={slot}
                files={filesInSlot(record, slot)}
                multiSlotMax={multiSlotMax}
                required={item?.required ?? false}
                conditionNote={conditionNote(item, t)}
                locked={locked}
                onUpload={(files) => handleUpload(slot, files)}
                onDelete={(fileId) => handleDeleteDocument(slot, fileId)}
              />
            );
          })}
        </CardContent>
      </Card>

      {/* ─── Submit ───────────────────────────────────────────────────────── */}
      {!locked && (
        <Card className={sectionSurfaceClass}>
          <SectionHeading
            icon={Send}
            title={t('verification.submit.title')}
            description={t('verification.submit.description')}
            short={t('verification.submit.short')}
          />
          <CardContent className="space-y-3 max-md:px-0">
            {outstanding.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {t('verification.submit.outstanding', { count: outstanding.length })}
                </span>
              </div>
            )}
            <Button
              type="button"
              className="gap-2"
              disabled={submitting || dirty}
              onClick={() => setConfirmSubmit(true)}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t(phase === 'rejected' ? 'verification.submit.resubmit' : 'verification.submit.action')}
            </Button>
            {dirty && (
              <p className="text-xs text-muted-foreground">{t('verification.submit.saveFirst')}</p>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('verification.submit.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('verification.submit.confirmBody')}
              {outstanding.length > 0 && ` ${t('verification.submit.confirmIncomplete')}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(e) => {
                // The dialog closes on its own action; keep it open until the
                // request settles so the spinner is visible where it was clicked.
                e.preventDefault();
                void handleSubmit();
              }}
            >
              {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('verification.submit.confirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!locked && (
        <UnsavedChangesBar
          visible={dirty || saving}
          saving={saving}
          onDiscard={handleDiscard}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// ─── Bits ─────────────────────────────────────────────────────────────────────

/** Which checklist row grades each slot. Both ID scans share one row. */
const SLOT_CHECKLIST_KEY: Record<KycDocumentSlot, KycChecklistKey> = {
  id_card_front: 'idCard',
  id_card_back: 'idCard',
  selfie_with_id: 'selfie',
  home_address_sketch: 'homeSketch',
  store_address_sketch: 'storeSketch',
};

function PhaseBadge({ phase }: { phase: ReturnType<typeof kycPhase> }) {
  const { t } = useTranslation('account');
  const label = t(`verification.phase.${phase}` as never);

  if (phase === 'verified') {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-600">
        <CheckCircle2 className="h-3 w-3" /> {label}
      </Badge>
    );
  }
  if (phase === 'rejected') {
    return (
      <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
        <XCircle className="h-3 w-3" /> {label}
      </Badge>
    );
  }
  if (phase === 'under_review') {
    return (
      <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700 dark:text-amber-400">
        <Clock className="h-3 w-3" /> {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {label}
    </Badge>
  );
}

function ChecklistRow({ item }: { item: KycChecklistItem }) {
  const { t } = useTranslation('account');
  const Icon = item.met ? CheckCircle2 : item.required ? AlertTriangle : Circle;

  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          item.met
            ? 'text-emerald-600'
            : item.required
              ? 'text-amber-600'
              : 'text-muted-foreground/60',
        )}
      />
      <span className="min-w-0 flex-1">
        <span className={cn(item.met && 'text-muted-foreground')}>
          {t(`verification.checklist.items.${item.key}` as never)}
        </span>
        <span className="ms-2 text-xs text-muted-foreground">
          {item.required
            ? t('verification.checklist.required')
            : t('verification.checklist.optional')}
        </span>
        {item.editedElsewhere && (
          <span className="block text-xs text-muted-foreground">
            {t('verification.checklist.elsewhere')}
          </span>
        )}
      </span>
    </li>
  );
}

/** One line saying why a conditional slot is, or is not, being asked for. */
function conditionNote(
  item: KycChecklistItem | undefined,
  t: ReturnType<typeof useTranslation<['account', 'common']>>['t'],
): string | undefined {
  if (!item?.condition) return undefined;
  if (item.condition === 'noDepot') {
    return item.required
      ? t('verification.conditions.requiredNoDepot')
      : t('verification.conditions.notNeededHasDepot');
  }
  return item.required
    ? t('verification.conditions.requiredHasDepot')
    : t('verification.conditions.notNeededNoDepot');
}
