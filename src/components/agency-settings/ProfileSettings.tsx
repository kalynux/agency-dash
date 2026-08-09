import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  Clock,
  Globe,
  Lock,
  Store as StoreIcon,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useResource } from '@/hooks/useResource';
import { agencyProfileService } from '@/services/agency-profile.service';
import { getApiErrorMessage } from '@/lib/errors';
import { useLanguage } from '@/i18n/useLanguage';
import { formatPhoneDisplay, toPhoneCountry } from '@/lib/phone';
import { normalizeLanguage, type LanguageCode } from '@/i18n/config';
import type {
  DeliveryAgencyProfile,
  UpdateAgencyProfilePayload,
} from '@/types/agency-profile.types';

import { TIMEZONES } from '@/lib/timezones';
import { LoadingState, ErrorState } from '@/components/common/state-views';
import { UnsavedChangesBar } from '@/components/agency-settings/UnsavedChangesBar';
import { MediaPickerTrigger } from '@/components/common/MediaPickerTrigger';
import { SectionHeading } from '@/components/common/InfoHint';
import { sectionGroupClass, sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
// import { Badge } from '@/components/ui/badge'; // with the commented-out KycBadge below
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * `preferred_language` is one setting with two effects: the language the backend
 * renders notifications in, and the language this dashboard renders in. The
 * option list therefore comes from `i18n/config` — the same table the runtime
 * loads bundles from — so the two can never drift apart.
 */
type Language = LanguageCode;

/** Lightweight avatar preview ref — `.id` is what the PATCH sends as `avatarFileId`. */
interface AvatarRef {
  id: string;
  url: string;
}

interface FormState {
  displayName: string;
  timezone: string;
  language: Language;
  avatar: AvatarRef | null;
  registrationNumber: string;
  transportLicenseId: string;
}

function toForm(p: DeliveryAgencyProfile): FormState {
  return {
    displayName: p.displayName ?? '',
    timezone: p.timezone ?? '',
    language: normalizeLanguage(p.preferredLanguage),
    avatar: p.avatar ? { id: p.avatar.id, url: p.avatar.url } : null,
    registrationNumber: p.kycDetails?.registration_number ?? '',
    transportLicenseId: p.kycDetails?.transport_license_id ?? '',
  };
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Build the PATCH /agency/profile payload from the diff between the form and the
 * stored profile. Only changed fields are sent. `displayName` and `timezone` are
 * NOT clearable (min-length constraints) so empty values are never sent for them.
 * KYC ids are clearable (empty → explicit `null`). This endpoint has no
 * optimistic locking (no `version`).
 */
function buildPayload(form: FormState, profile: DeliveryAgencyProfile): UpdateAgencyProfilePayload {
  const payload: UpdateAgencyProfilePayload = {};

  const name = form.displayName.trim();
  if (name !== (profile.displayName ?? '')) payload.displayName = name;

  if (form.timezone && form.timezone !== profile.timezone) payload.timezone = form.timezone;

  if (form.language !== normalizeLanguage(profile.preferredLanguage)) {
    payload.preferred_language = form.language;
  }

  if ((form.avatar?.id ?? null) !== (profile.avatar?.id ?? null)) {
    payload.avatarFileId = form.avatar?.id ?? null;
  }

  const reg = form.registrationNumber.trim() || null;
  const lic = form.transportLicenseId.trim() || null;
  if (reg !== (profile.kycDetails?.registration_number ?? null) ||
      lic !== (profile.kycDetails?.transport_license_id ?? null)) {
    payload.kyc_details = { registration_number: reg, transport_license_id: lic };
  }

  return payload;
}

export function ProfileSettings() {
  const { t } = useTranslation(['account', 'common']);
  const { languages, setLanguage, syncFromProfile } = useLanguage();
  const { data: profile, isLoading, error, refetch, setData } = useResource(
    () => agencyProfileService.getProfile().then((r) => r.data),
    [],
  );

  const [form, setForm] = useState<FormState | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setForm(toForm(profile));
      setNameError(null);
      // The stored preference is authoritative on first load — adopt it unless
      // the user has already picked something in this session.
      syncFromProfile(profile.preferredLanguage);
    }
  }, [profile, syncFromProfile]);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    if (key === 'displayName') setNameError(null);
  }, []);

  /**
   * Language is the one field that takes effect before Save: the picker is the
   * preview. Discard puts it back, and Save is what makes it durable on the
   * profile (which is also what the backend renders notifications in).
   */
  const pickLanguage = useCallback(
    (next: Language) => {
      set('language', next);
      setLanguage(next);
    },
    [set, setLanguage],
  );

  const dirty = useMemo(() => {
    if (!profile || !form) return false;
    return Object.keys(buildPayload(form, profile)).length > 0;
  }, [profile, form]);

  const handleDiscard = useCallback(() => {
    if (profile) {
      setForm(toForm(profile));
      setNameError(null);
      setSaveError(null);
      // Undo the live preview too, or the UI would stay in a language the
      // profile no longer claims.
      setLanguage(normalizeLanguage(profile.preferredLanguage));
    }
  }, [profile, setLanguage]);

  const handleSave = useCallback(async () => {
    if (!profile || !form) return;

    // displayName is required (2–100) and not clearable.
    if (form.displayName.trim().length < 2) {
      setNameError(t('profile.identity.displayNameTooShort'));
      setSaveError(t('profile.saveError'));
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await agencyProfileService.updateProfile(buildPayload(form, profile));
      setData(res.data);
      toast.success(t('profile.saved'));
    } catch (err) {
      setSaveError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [profile, form, setData, t]);

  if (isLoading && !profile) return <LoadingState label={t('profile.loading')} />;
  if (error && !profile) return <ErrorState error={error} onRetry={refetch} />;
  if (!profile || !form) return null;

  const avatarUrl = form.avatar?.url;
  const displayName = form.displayName || t('profile.fallbackName');
  const languageDirty = form.language !== normalizeLanguage(profile.preferredLanguage);

  return (
    <div className={sectionGroupClass}>
      {saveError && (
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {saveError}
        </div>
      )}

      {/* ─── Personal details ─────────────────────────────────────────────── */}
      <Card className={sectionSurfaceClass}>
        <SectionHeading
          title={t('profile.identity.title')}
          description={t('profile.identity.description')}
          short={t('profile.identity.short')}
        />
        <CardContent className="space-y-6 max-md:px-0">
          {/* Avatar — the picture itself opens the media library. */}
          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
              <MediaPickerTrigger
                label={t('common:media.changePhoto')}
                acceptedTypes={['image']}
                onSelect={(media) => set('avatar', media)}
                className="rounded-full ring-2 ring-border"
              >
                <Avatar className="w-24 h-24">
                  {avatarUrl && (
                    <AvatarImage
                      src={avatarUrl}
                      alt={displayName}
                      crossOrigin="use-credentials"
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="text-2xl font-medium">{initialsFrom(displayName)}</AvatarFallback>
                </Avatar>
              </MediaPickerTrigger>
              {form.avatar && (
                <button
                  type="button"
                  aria-label={t('common:media.removePhoto')}
                  onClick={() => set('avatar', null)}
                  className="absolute right-0 top-0 rounded-full border border-border bg-background p-1 text-muted-foreground shadow-sm transition-colors hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="space-y-1">
              <p className="font-medium">{displayName}</p>
              <p className="text-sm text-muted-foreground">{profile.email ?? '—'}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <StoreIcon className="w-3 h-3" />
                {t('profile.identity.storeHint')}
              </p>
              <p className="pt-1 text-xs text-muted-foreground">{t('profile.identity.avatarHint')}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agency-displayname">{t('profile.identity.displayName')}</Label>
              <Input
                id="agency-displayname"
                value={form.displayName}
                onChange={(e) => set('displayName', e.target.value)}
                maxLength={100}
                aria-invalid={!!nameError}
                placeholder={t('profile.identity.displayNamePlaceholder')}
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('profile.identity.email')}</Label>
              <div className="relative">
                <Input id="email" type="email" value={profile.email ?? ''} readOnly disabled />
                {profile.emailVerified && (
                  <CheckCircle2 className="absolute right-3 top-1/2 w-4 h-4 -translate-y-1/2 text-green-600" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t('profile.identity.emailLocked')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t('profile.identity.phone')}</Label>
              <div className="relative">
                <Input
                  id="phone"
                  // Read-only here (it is the login identity), but shown in the
                  // same international grouping every editable phone field uses.
                  value={formatPhoneDisplay(profile.phone, toPhoneCountry(profile.country))}
                  readOnly
                  disabled
                  placeholder={t('profile.identity.phonePlaceholder')}
                />
                {profile.phoneVerified && (
                  <CheckCircle2 className="absolute right-3 top-1/2 w-4 h-4 -translate-y-1/2 text-green-600" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t('profile.identity.phoneLocked')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Localization ─────────────────────────────────────────────────── */}
      <Card className={sectionSurfaceClass}>
        <SectionHeading
          icon={Globe}
          title={t('profile.localization.title')}
          description={t('profile.localization.description')}
          short={t('profile.localization.short')}
        />
        <CardContent className="max-md:px-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-muted-foreground">
                <Lock className="w-3 h-3" /> {t('profile.localization.country')}
              </Label>
              <Input
                value={profile.country ?? t('common:values.notAvailable')}
                disabled
                readOnly
                aria-label={t('profile.localization.countryAria')}
              />
              <p className="text-xs text-muted-foreground">{t('profile.localization.countryLocked')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agency-timezone" className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {t('profile.localization.timezone')}
              </Label>
              <Select value={form.timezone} onValueChange={(v) => set('timezone', v)}>
                <SelectTrigger id="agency-timezone">
                  <SelectValue placeholder={t('profile.localization.timezonePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agency-language">{t('profile.localization.language')}</Label>
              <Select value={form.language} onValueChange={(v) => pickLanguage(v as Language)}>
                <SelectTrigger id="agency-language">
                  <SelectValue placeholder={t('profile.localization.languagePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((l) => (
                    // Each option is written in its own language: a user who
                    // can't read the current UI still has to find theirs.
                    <SelectItem key={l.code} value={l.code} lang={l.code} dir={l.dir}>
                      {l.nativeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {languageDirty
                  ? t('profile.localization.languagePreviewHint')
                  : t('profile.localization.languageHint')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── KYC / Verification ───────────────────────────────────────────── */}
      {/* <Card className={sectionSurfaceClass}>
        <SectionHeading
          icon={ShieldCheck}
          title={t('profile.kyc.title')}
          description={t('profile.kyc.description')}
          short={t('profile.kyc.short')}
          action={<KycBadge verified={profile.kycVerified} />}
        />
        <CardContent className="max-md:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reg-number">{t('profile.kyc.registrationNumber')}</Label>
              <Input
                id="reg-number"
                value={form.registrationNumber}
                onChange={(e) => set('registrationNumber', e.target.value)}
                placeholder={t('profile.kyc.registrationNumberPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport-license">{t('profile.kyc.transportLicense')}</Label>
              <Input
                id="transport-license"
                value={form.transportLicenseId}
                onChange={(e) => set('transportLicenseId', e.target.value)}
                placeholder={t('profile.kyc.transportLicensePlaceholder')}
              />
            </div>
          </div>
        </CardContent>
      </Card> */}

      <UnsavedChangesBar
        visible={dirty || saving}
        saving={saving}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    </div>
  );
}

// Commented out alongside the KYC card above — kept together so restoring the
// section is one uncomment, not a rewrite. Re-add the `ShieldCheck` import with it.
// function KycBadge({ verified }: { verified: boolean }) {
//   const { t } = useTranslation(['account', 'common']);
//   if (verified) {
//     return (
//       <Badge variant="outline" className="gap-1 border-green-200 text-green-600">
//         <CheckCircle2 className="w-3 h-3" /> {t('profile.kyc.verified')}
//       </Badge>
//     );
//   }
//   return (
//     <Badge variant="outline" className="border-amber-200 text-amber-600">
//       {t('profile.kyc.pending')}
//     </Badge>
//   );
// }
