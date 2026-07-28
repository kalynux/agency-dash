import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  Loader2,
  X,
  Store as StoreIcon,
  Camera,
  Mail,
  Phone,
  MessageCircle,
  CalendarDays,
  LifeBuoy,
  Info,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useResource } from '@/hooks/useResource';
import { useFileUpload } from '@/hooks/useFileUpload';
import { magazinService } from '@/services/magazin.service';
import { getApiErrorMessage } from '@/lib/errors';
import { ApiError } from '@/types/api';
import type { AgencyMagazin, MagazinUpdatePayload } from '@/types/magazin.types';

import { LoadingState, ErrorState } from '@/components/common/state-views';
import { UnsavedChangesBar } from '@/components/agency-settings/UnsavedChangesBar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

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

/**
 * Build the PATCH payload from the diff between the edited form and the stored
 * magazin, always including `version`. Only changed fields are sent (partial
 * update). `name` is sent as-is (required); every other field is null-normalized.
 */
function buildPayload(form: FormState, magazin: AgencyMagazin): MagazinUpdatePayload {
  const payload: MagazinUpdatePayload = { version: magazin.version };

  if (form.name.trim() !== (magazin.name ?? '')) payload.name = form.name.trim();

  const stringFields: Exclude<EditableKey, 'name'>[] = [
    'description',
    'supportEmail',
    'supportPhone',
    'supportWhatsapp',
  ];
  for (const key of stringFields) {
    const next = norm(form[key]);
    if (next !== (magazin[key] ?? null)) payload[key] = next;
  }

  // Send the file id (or `null` to detach) only when the selected logo changed.
  if ((form.logo?.id ?? null) !== (magazin.logo?.id ?? null)) {
    payload.logoFileId = form.logo?.id ?? null;
  }

  return payload;
}

/** Client-side validation mirroring the PATCH /agency/magazin constraints. */
function validateForm(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  const name = form.name.trim();
  if (name.length < 2) errors.name = 'Business name must be at least 2 characters.';
  else if (name.length > 100) errors.name = 'Business name must be at most 100 characters.';

  const email = form.supportEmail.trim();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    errors.supportEmail = 'Enter a valid email address.';
  }

  for (const key of ['supportPhone', 'supportWhatsapp'] as const) {
    const value = form[key].trim();
    if (value && (value.length < 8 || value.length > 20)) {
      errors[key] = 'Must be between 8 and 20 characters.';
    }
  }

  return errors;
}

export function MagazinSettings() {
  const { data: magazin, isLoading, error, refetch, setData } = useResource(
    () => magazinService.getMagazin(),
    [],
  );

  const [form, setForm] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { isUploading, upload } = useFileUpload();
  const logoInputRef = useRef<HTMLInputElement>(null);

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
    return Object.keys(buildPayload(form, magazin)).length > 1; // more than just `version`
  }, [magazin, form]);

  const handleLogoFile = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const uploaded = await upload([files[0]]);
      if (logoInputRef.current) logoInputRef.current.value = '';
      if (uploaded && uploaded[0]) {
        set('logo', { id: uploaded[0].id, url: uploaded[0].url });
      }
    },
    [upload, set],
  );

  const handleDiscard = useCallback(() => {
    if (magazin) {
      setForm(toForm(magazin));
      setFieldErrors({});
      setSaveError(null);
    }
  }, [magazin]);

  const handleSave = useCallback(async () => {
    if (!magazin || !form) return;

    const errors = validateForm(form);
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors);
      setSaveError('Please fix the highlighted fields before saving.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const updated = await magazinService.updateMagazin(buildPayload(form, magazin));
      setData(updated);
      toast.success('Business details updated');
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) {
        // Optimistic-locking clash — refresh so the agency edits the latest.
        toast.error('Business details were updated elsewhere. Refreshed — please re-apply your changes.');
        await refetch();
      } else {
        setSaveError(getApiErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }, [magazin, form, setData, refetch]);

  if (isLoading && !magazin) return <LoadingState label="Loading business details…" />;
  if (error && !magazin) return <ErrorState error={error} onRetry={refetch} />;
  if (!magazin || !form) return null;

  const previewName = form.name.trim() || magazin.name;

  return (
    <div className="space-y-6">
      {/* ─── Identity hero ────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            {form.logo ? (
              <>
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border bg-muted shadow-sm">
                  <img
                    src={form.logo.url}
                    alt="Business logo"
                    crossOrigin="use-credentials"
                    className="h-full w-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  aria-label="Change logo"
                  disabled={isUploading}
                  onClick={() => logoInputRef.current?.click()}
                  className="absolute -bottom-1.5 -right-1.5 rounded-full border border-border bg-background p-1.5 text-foreground shadow-sm transition-colors hover:bg-accent disabled:opacity-60"
                >
                  {isUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Remove logo"
                  onClick={() => set('logo', null)}
                  className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-background p-1 text-muted-foreground shadow-sm transition-colors hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            ) : (
              // No logo yet — the whole box is a click target to add one.
              <button
                type="button"
                aria-label="Add logo"
                disabled={isUploading}
                onClick={() => logoInputRef.current?.click()}
                className="group flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border bg-muted shadow-sm transition-colors hover:bg-accent disabled:opacity-60"
              >
                {isUploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                ) : (
                  <StoreIcon className="w-8 h-8 text-muted-foreground transition-colors group-hover:text-foreground" />
                )}
              </button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleLogoFile(e.target.files)}
            />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="truncate text-xl font-bold leading-tight">{previewName}</h2>
            <p className="text-sm text-muted-foreground">
              Your agency's business identity — the name, logo and contacts vendors and customers see.
            </p>
          </div>
        </CardContent>
      </Card>

      {saveError && (
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {saveError}
        </div>
      )}

      {/* ─── Forms + side rail ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StoreIcon className="w-4 h-4 text-muted-foreground" />
                Business identity
              </CardTitle>
              <CardDescription>The name and description that represent your agency.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="magazin-name">Business name</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">{form.name.length}/100</span>
                </div>
                <Input
                  id="magazin-name"
                  value={form.name}
                  maxLength={100}
                  aria-invalid={!!fieldErrors.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Your agency's business name"
                />
                <FieldError message={fieldErrors.name} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="magazin-description">Description</Label>
                  <span
                    className={cn(
                      'text-xs tabular-nums text-muted-foreground',
                      form.description.length > 900 && 'text-amber-600 dark:text-amber-500',
                    )}
                  >
                    {form.description.length}/1000
                  </span>
                </div>
                <Textarea
                  id="magazin-description"
                  value={form.description}
                  maxLength={1000}
                  rows={5}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Tell vendors what your agency does — coverage, strengths, what sets you apart"
                  className="resize-y"
                />
              </div>
            </CardContent>
          </Card>

          {/* Support contacts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-muted-foreground" />
                Support & contact
              </CardTitle>
              <CardDescription>How vendors and customers reach your agency about deliveries.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="magazin-email">Support email</Label>
                  <IconInput
                    icon={Mail}
                    id="magazin-email"
                    type="email"
                    value={form.supportEmail}
                    aria-invalid={!!fieldErrors.supportEmail}
                    onChange={(e) => set('supportEmail', e.target.value)}
                    placeholder="support@youragency.com"
                  />
                  <FieldError message={fieldErrors.supportEmail} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="magazin-phone">Support phone</Label>
                  <IconInput
                    icon={Phone}
                    id="magazin-phone"
                    value={form.supportPhone}
                    maxLength={20}
                    aria-invalid={!!fieldErrors.supportPhone}
                    onChange={(e) => set('supportPhone', e.target.value)}
                    placeholder="+2376…"
                  />
                  <FieldError message={fieldErrors.supportPhone} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="magazin-wa">WhatsApp</Label>
                  <IconInput
                    icon={MessageCircle}
                    id="magazin-wa"
                    value={form.supportWhatsapp}
                    maxLength={20}
                    aria-invalid={!!fieldErrors.supportWhatsapp}
                    onChange={(e) => set('supportWhatsapp', e.target.value)}
                    placeholder="+2376…"
                  />
                  <FieldError message={fieldErrors.supportWhatsapp} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side rail */}
        <div className="space-y-6">
          {/* Profile vs. Store explainer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-4 h-4 text-muted-foreground" />
                Business vs. personal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                This tab is your agency's <span className="font-medium text-foreground">business identity</span> —
                the public name, logo and support contacts.
              </p>
              <p className="flex items-start gap-2">
                <UserCog className="mt-0.5 w-4 h-4 shrink-0" />
                <span>
                  Your <span className="font-medium text-foreground">personal</span> contact name and avatar live on
                  the <span className="font-medium text-foreground">Profile</span> tab instead.
                </span>
              </p>
            </CardContent>
          </Card>

          {/* Read-only details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>Fixed properties of your business profile.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailRow icon={CalendarDays} label="Last updated">
                <span className="text-sm">{formatDate(magazin.updatedAt)}</span>
              </DetailRow>
              <Separator />
              <DetailRow icon={CalendarDays} label="Created">
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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
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
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
