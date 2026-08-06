import { formatDate as fmtDate } from '@/lib/format';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  X,
  Store as StoreIcon,
  Mail,
  CalendarDays,
  LifeBuoy,
  Info,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useMagazin } from '@/store/magazin.store';
import { magazinService } from '@/services/magazin.service';
import { getApiErrorMessage } from '@/lib/errors';
import type { AnyTFunction } from '@/i18n/tx';
import { useDefaultPhoneCountry } from '@/hooks/useDefaultPhoneCountry';
import { phoneIssue, toSubmittablePhone, type CountryCode } from '@/lib/phone';
import { phoneErrorMessage } from '@/lib/validation-schemas';
import { ApiError } from '@/types/api';
import type { AgencyMagazin, MagazinUpdatePayload } from '@/types/magazin.types';

import { PhoneInput } from '@/components/common/PhoneInput';
import { LoadingState, ErrorState } from '@/components/common/state-views';
import { UnsavedChangesBar } from '@/components/agency-settings/UnsavedChangesBar';
import { MediaPickerTrigger } from '@/components/common/MediaPickerTrigger';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { SectionHeading } from '@/components/common/InfoHint';
import {
  noteSurfaceClass,
  sectionGroupClass,
  sectionRuleClass,
  sectionSurfaceClass,
} from '@/components/layout/PageContainer';

// The editable string fields, in payload key order. `name` is required (2–100);
// the rest are nullable/clearable. The magazin carries no address, slug, or
// vacation mode — an agency is not a public storefront.
type EditableKey =
  | 'name'
  | 'description'
  | 'supportEmail'
  | 'supportPhone'
  | 'supportWhatsapp';

/** Lightweight logo preview ref — `.id` is what the PATCH sends as `logoFileId`. */
interface LogoRef {
  id: string;
  url: string;
}

interface FormState {
  name: string;
  description: string;
  logo: LogoRef | null;
  supportEmail: string;
  supportPhone: string;
  supportWhatsapp: string;
}

type FieldErrors = Partial<Record<EditableKey, string>>;

function toForm(m: AgencyMagazin): FormState {
  return {
    name: m.name ?? '',
    description: m.description ?? '',
    logo: m.logo ? { id: m.logo.id, url: m.logo.url } : null,
    supportEmail: m.supportEmail ?? '',
    supportPhone: m.supportPhone ?? '',
    supportWhatsapp: m.supportWhatsapp ?? '',
  };
}

/** Normalize an editable text value: trim, and treat an empty string as `null`. */
function norm(v: string): string | null {
  const t = v.trim();
  return t === '' ? null : t;
}

/** The two support contacts that are phone numbers, normalized to E.164 or `null`. */
const PHONE_FIELDS = new Set<EditableKey>(['supportPhone', 'supportWhatsapp']);

function normPhone(v: string | null | undefined, country: CountryCode | null): string | null {
  return toSubmittablePhone(v, country) || null;
}

/**
 * Build the PATCH payload from the diff between the edited form and the stored
 * magazin, always including `version`. Only changed fields are sent (partial
 * update). `name` is sent as-is (required); every other field is null-normalized.
 *
 * Phone fields are compared *after* normalization on both sides, so a legacy
 * number stored in local format doesn't read as an edit the moment the page
 * loads — and once one is actually touched, E.164 is what goes out.
 */
function buildPayload(
  form: FormState,
  magazin: AgencyMagazin,
  country: CountryCode | null,
): MagazinUpdatePayload {
  const payload: MagazinUpdatePayload = { version: magazin.version };

  if (form.name.trim() !== (magazin.name ?? '')) payload.name = form.name.trim();

  const stringFields: Exclude<EditableKey, 'name'>[] = [
    'description',
    'supportEmail',
    'supportPhone',
    'supportWhatsapp',
  ];
  for (const key of stringFields) {
    const isPhone = PHONE_FIELDS.has(key);
    const next = isPhone ? normPhone(form[key], country) : norm(form[key]);
    const stored = isPhone ? normPhone(magazin[key], country) : (magazin[key] ?? null);
    if (next !== stored) payload[key] = next;
  }

  // Send the file id (or `null` to detach) only when the selected logo changed.
  if ((form.logo?.id ?? null) !== (magazin.logo?.id ?? null)) {
    payload.logoFileId = form.logo?.id ?? null;
  }

  return payload;
}

/** Client-side validation mirroring the PATCH /agency/magazin constraints. */
function validateForm(form: FormState, t: AnyTFunction, country: CountryCode | null): FieldErrors {
  const errors: FieldErrors = {};

  const name = form.name.trim();
  if (name.length < 2) errors.name = t('settings:store.validation.nameMin');
  else if (name.length > 100) errors.name = t('settings:store.validation.nameMax');

  const email = form.supportEmail.trim();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    errors.supportEmail = t('settings:store.validation.email');
  }

  // Both are optional and clearable — but a number that IS given has to be one
  // someone could actually call.
  for (const key of ['supportPhone', 'supportWhatsapp'] as const) {
    const issue = phoneIssue(form[key], { required: false, country });
    if (issue) errors[key] = phoneErrorMessage(t, issue);
  }

  return errors;
}

export function MagazinSettings() {
  const { t } = useTranslation(['settings', 'common']);
  // Shared with the app chrome (sidebar identity block) — saving through `setData`
  // updates the business name and logo everywhere without a refetch.
  const { data: magazin, isLoading, error, refetch, setData } = useMagazin();
  // Where the support-number pickers open, and how a legacy number stored
  // without a `+` is read back.
  const phoneCountry = useDefaultPhoneCountry();

  const [form, setForm] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // (Re)seed the form whenever the underlying magazin changes (load / save).
  useEffect(() => {
    if (magazin) {
      setForm(toForm(magazin));
      setFieldErrors({});
    }
  }, [magazin]);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    // Editing a field clears its stale validation error.
    setFieldErrors((prev) => (key in prev ? { ...prev, [key]: undefined } : prev));
  }, []);

  const dirty = useMemo(() => {
    if (!magazin || !form) return false;
    return Object.keys(buildPayload(form, magazin, phoneCountry)).length > 1; // more than just `version`
  }, [magazin, form, phoneCountry]);

  const handleDiscard = useCallback(() => {
    if (magazin) {
      setForm(toForm(magazin));
      setFieldErrors({});
      setSaveError(null);
    }
  }, [magazin]);

  const handleSave = useCallback(async () => {
    if (!magazin || !form) return;

    const errors = validateForm(form, t, phoneCountry);
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors);
      setSaveError(t('common.fixHighlighted'));
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const updated = await magazinService.updateMagazin(buildPayload(form, magazin, phoneCountry));
      setData(updated);
      toast.success(t('store.saved'));
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) {
        // Optimistic-locking clash — refresh so the agency edits the latest.
        toast.error(t('store.conflict'));
        await refetch();
      } else {
        setSaveError(getApiErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }, [magazin, form, setData, refetch, t, phoneCountry]);

  if (isLoading && !magazin) return <LoadingState label={t('store.loading')} />;
  if (error && !magazin) return <ErrorState error={error} onRetry={refetch} />;
  if (!magazin || !form) return null;

  const previewName = form.name.trim() || magazin.name;

  return (
    <div className="space-y-6">
      {/* ─── Identity hero ────────────────────────────────────────────────── */}
      {/* Keeps a surface on mobile: it has no heading, so de-carded it would
          read as stray text at the top of the page rather than as a block. */}
      <Card className={noteSurfaceClass}>
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center max-md:px-4">
          {/* The logo box itself is the click target — it opens the media library. */}
          <div className="relative shrink-0">
            <MediaPickerTrigger
              label={form.logo ? t('store.changeLogo') : t('store.addLogo')}
              acceptedTypes={['image']}
              onSelect={(media) => set('logo', media)}
              className="h-20 w-20 rounded-xl border bg-muted shadow-sm"
            >
              {form.logo ? (
                <img
                  src={form.logo.url}
                  alt={t('store.logoAlt')}
                  crossOrigin="use-credentials"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  <StoreIcon className="w-8 h-8 text-muted-foreground" />
                </span>
              )}
            </MediaPickerTrigger>
            {form.logo && (
              <button
                type="button"
                aria-label={t('store.removeLogo')}
                onClick={() => set('logo', null)}
                className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-background p-1 text-muted-foreground shadow-sm transition-colors hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="truncate text-xl font-bold leading-tight">{previewName}</h2>
            <p className="text-sm text-muted-foreground max-md:hidden">{t('store.heroDescription')}</p>
            <p className="text-xs text-muted-foreground">{t('store.heroHint')}</p>
          </div>
        </CardContent>
      </Card>

      {saveError && (
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {saveError}
        </div>
      )}

      {/* ─── Forms + side rail ───────────────────────────────────────────── */}
      {/* The grid stops `sectionGroupClass`'s `>` combinator, so each column
          opens its own group and the boundaries are ruled off by hand. */}
      <div className={cn('grid grid-cols-1 items-start gap-6 lg:grid-cols-3', sectionRuleClass)}>
        {/* Main column */}
        <div className={cn(sectionGroupClass, 'lg:col-span-2')}>
          {/* Identity */}
          <Card className={sectionSurfaceClass}>
            <SectionHeading
              icon={StoreIcon}
              title={t('store.identity.title')}
              description={t('store.identity.description')}
              short={t('store.identity.short')}
            />
            <CardContent className="space-y-5 max-md:px-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="magazin-name">{t('store.identity.name')}</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {t('store.identity.counter', { used: form.name.length, max: 100 })}
                  </span>
                </div>
                <Input
                  id="magazin-name"
                  value={form.name}
                  maxLength={100}
                  aria-invalid={!!fieldErrors.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder={t('store.identity.namePlaceholder')}
                />
                <FieldError message={fieldErrors.name} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="magazin-description">{t('store.identity.description_')}</Label>
                  <span
                    className={cn(
                      'text-xs tabular-nums text-muted-foreground',
                      form.description.length > 900 && 'text-amber-600 dark:text-amber-500',
                    )}
                  >
                    {t('store.identity.counter', { used: form.description.length, max: 1000 })}
                  </span>
                </div>
                <Textarea
                  id="magazin-description"
                  value={form.description}
                  maxLength={1000}
                  rows={5}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder={t('store.identity.descriptionPlaceholder')}
                  className="resize-y"
                />
              </div>
            </CardContent>
          </Card>

          {/* Support contacts */}
          <Card className={sectionSurfaceClass}>
            <SectionHeading
              icon={LifeBuoy}
              title={t('store.support.title')}
              description={t('store.support.description')}
              short={t('store.support.short')}
            />
            <CardContent className="max-md:px-0">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="magazin-email">{t('store.support.email')}</Label>
                  <IconInput
                    icon={Mail}
                    id="magazin-email"
                    type="email"
                    value={form.supportEmail}
                    aria-invalid={!!fieldErrors.supportEmail}
                    onChange={(e) => set('supportEmail', e.target.value)}
                    placeholder={t('store.support.emailPlaceholder')}
                  />
                  <FieldError message={fieldErrors.supportEmail} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="magazin-phone">{t('store.support.phone')}</Label>
                  <PhoneInput
                    id="magazin-phone"
                    value={form.supportPhone}
                    onChange={(phone) => set('supportPhone', phone)}
                    hasError={!!fieldErrors.supportPhone}
                    describedBy={fieldErrors.supportPhone ? 'magazin-phone-error' : undefined}
                  />
                  <FieldError id="magazin-phone-error" message={fieldErrors.supportPhone} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="magazin-wa">{t('store.support.whatsapp')}</Label>
                  <PhoneInput
                    id="magazin-wa"
                    value={form.supportWhatsapp}
                    onChange={(phone) => set('supportWhatsapp', phone)}
                    hasError={!!fieldErrors.supportWhatsapp}
                    describedBy={fieldErrors.supportWhatsapp ? 'magazin-wa-error' : undefined}
                  />
                  <FieldError id="magazin-wa-error" message={fieldErrors.supportWhatsapp} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side rail */}
        <div className={cn(sectionGroupClass, sectionRuleClass)}>
          {/* Profile vs. Store explainer */}
          <Card className={sectionSurfaceClass}>
            <SectionHeading icon={Info} title={t('store.explainer.title')} />
            <CardContent className="space-y-3 text-sm text-muted-foreground max-md:px-0">
              <p>
                <Trans
                  ns="settings"
                  i18nKey="store.explainer.line1"
                  components={{ strong: <span className="font-medium text-foreground" /> }}
                />
              </p>
              <p className="flex items-start gap-2">
                <UserCog className="mt-0.5 w-4 h-4 shrink-0" />
                <span>
                  <Trans
                    ns="settings"
                    i18nKey="store.explainer.line2"
                    components={{ strong: <span className="font-medium text-foreground" /> }}
                  />
                </span>
              </p>
            </CardContent>
          </Card>

          {/* Read-only details */}
          <Card className={sectionSurfaceClass}>
            <SectionHeading title={t('store.details.title')} description={t('store.details.description')} />
            <CardContent className="space-y-4 max-md:px-0">
              <DetailRow icon={CalendarDays} label={t('store.details.lastUpdated')}>
                <span className="text-sm">{formatDate(magazin.updatedAt)}</span>
              </DetailRow>
              <Separator />
              <DetailRow icon={CalendarDays} label={t('store.details.created')}>
                <span className="text-sm">{formatDate(magazin.createdAt)}</span>
              </DetailRow>
            </CardContent>
          </Card>
        </div>
      </div>

      <UnsavedChangesBar
        visible={dirty || saving}
        saving={saving}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    </div>
  );
}

// ─── Presentational helpers ───────────────────────────────────────────────────

/** Input with a leading icon (support-contact fields). */
function IconInput({ icon: Icon, className, ...props }: ComponentProps<typeof Input> & { icon: LucideIcon }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
      <Input className={cn('pl-9', className)} {...props} />
    </div>
  );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="text-xs text-destructive">{message}</p>;
}

/** Labeled read-only row in the "Details" card. */
function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="w-3 h-3" /> {label}
      </p>
      {children}
    </div>
  );
}

function formatDate(iso: string): string {
  return fmtDate(iso);
}
