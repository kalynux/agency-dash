import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Globe,
  Lock,
  ShieldCheck,
  Store as StoreIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { useResource } from '@/hooks/useResource';
import { agencyProfileService } from '@/services/agency-profile.service';
import { getApiErrorMessage } from '@/lib/errors';
import type {
  DeliveryAgencyProfile,
  UpdateAgencyProfilePayload,
} from '@/types/agency-profile.types';

import { LoadingState, ErrorState } from '@/components/common/state-views';
import { UnsavedChangesBar } from '@/components/agency-settings/UnsavedChangesBar';
import { MediaPickerTrigger } from '@/components/common/MediaPickerTrigger';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TIMEZONES = [
  { value: 'Africa/Douala', label: 'Douala (WAT, UTC+1)' },
  { value: 'Africa/Lagos', label: 'Lagos (WAT, UTC+1)' },
  { value: 'Africa/Abidjan', label: 'Abidjan (GMT, UTC+0)' },
  { value: 'Africa/Nairobi', label: 'Nairobi (EAT, UTC+3)' },
  { value: 'Europe/Paris', label: 'Paris (CET, UTC+1)' },
];

/** Languages the backend renders all agency notifications in (preferred_language). */
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'es', label: 'Spanish' },
  { value: 'ar', label: 'Arabic' },
] as const;

type Language = (typeof LANGUAGES)[number]['value'];

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
    language: (p.preferredLanguage as Language) ?? 'en',
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

  if (form.language !== (profile.preferredLanguage as Language)) {
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
    }
  }, [profile]);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    if (key === 'displayName') setNameError(null);
  }, []);

  const dirty = useMemo(() => {
    if (!profile || !form) return false;
    return Object.keys(buildPayload(form, profile)).length > 0;
  }, [profile, form]);

  const handleDiscard = useCallback(() => {
    if (profile) {
      setForm(toForm(profile));
      setNameError(null);
      setSaveError(null);
    }
  }, [profile]);

  const handleSave = useCallback(async () => {
    if (!profile || !form) return;

    // displayName is required (2–100) and not clearable.
    if (form.displayName.trim().length < 2) {
      setNameError('Display name must be at least 2 characters.');
      setSaveError('Please fix the highlighted fields before saving.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await agencyProfileService.updateProfile(buildPayload(form, profile));
      setData(res.data);
      toast.success('Profile updated');
    } catch (err) {
      setSaveError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [profile, form, setData]);

  if (isLoading && !profile) return <LoadingState label="Loading your profile…" />;
  if (error && !profile) return <ErrorState error={error} onRetry={refetch} />;
  if (!profile || !form) return null;

  const avatarUrl = form.avatar?.url;
  const displayName = form.displayName || 'My Agency';

  return (
    <div className="space-y-6">
      {saveError && (
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {saveError}
        </div>
      )}

      {/* ─── Personal details ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Your personal contact details — separate from your business identity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar — the picture itself opens the media library. */}
          <div className="flex items-center gap-6">
            <MediaPickerTrigger
              label="Change photo"
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
            <div className="space-y-1">
              <p className="font-medium">{displayName}</p>
              <p className="text-sm text-muted-foreground">{profile.email ?? '—'}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <StoreIcon className="w-3 h-3" />
                Your business name &amp; logo live on the Store tab.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <p className="text-xs text-muted-foreground">Click your photo to pick a new one.</p>
                {form.avatar && (
                  <button
                    type="button"
                    onClick={() => set('avatar', null)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agency-displayname">Display Name</Label>
              <Input
                id="agency-displayname"
                value={form.displayName}
                onChange={(e) => set('displayName', e.target.value)}
                maxLength={100}
                aria-invalid={!!nameError}
                placeholder="e.g. Jean-Paul (FastTrack)"
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Input id="email" type="email" value={profile.email ?? ''} readOnly disabled />
                {profile.emailVerified && (
                  <CheckCircle2 className="absolute right-3 top-1/2 w-4 h-4 -translate-y-1/2 text-green-600" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">Email can't be changed here — contact support.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <div className="relative">
                <Input id="phone" value={profile.phone ?? ''} readOnly disabled placeholder="+237 6XX XXX XXX" />
                {profile.phoneVerified && (
                  <CheckCircle2 className="absolute right-3 top-1/2 w-4 h-4 -translate-y-1/2 text-green-600" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">Phone can't be changed here — contact support.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Localization ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            Localization
          </CardTitle>
          <CardDescription>Your operating country, timezone, and notification language.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-muted-foreground">
                <Lock className="w-3 h-3" /> Country
              </Label>
              <Input value={profile.country ?? '—'} disabled readOnly aria-label="Country (read-only)" />
              <p className="text-xs text-muted-foreground">Set once during onboarding.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agency-timezone" className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Timezone
              </Label>
              <Select value={form.timezone} onValueChange={(v) => set('timezone', v)}>
                <SelectTrigger id="agency-timezone">
                  <SelectValue placeholder="Select timezone" />
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
              <Label htmlFor="agency-language">Language</Label>
              <Select value={form.language} onValueChange={(v) => set('language', v as Language)}>
                <SelectTrigger id="agency-language">
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used for all your notifications.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── KYC / Verification ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              KYC / Verification
            </CardTitle>
            <KycBadge verified={profile.kycVerified} />
          </div>
          <CardDescription>Business registration details reviewed by our team.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reg-number">Business registration number</Label>
              <Input
                id="reg-number"
                value={form.registrationNumber}
                onChange={(e) => set('registrationNumber', e.target.value)}
                placeholder="e.g. RC/DLA/2020/B/1234"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport-license">Transport license ID</Label>
              <Input
                id="transport-license"
                value={form.transportLicenseId}
                onChange={(e) => set('transportLicenseId', e.target.value)}
                placeholder="e.g. TL-00998877"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <UnsavedChangesBar
        visible={dirty || saving}
        saving={saving}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    </div>
  );
}

function KycBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <Badge variant="outline" className="gap-1 border-green-200 text-green-600">
        <CheckCircle2 className="w-3 h-3" /> Verified
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-200 text-amber-600">
      Pending review
    </Badge>
  );
}
