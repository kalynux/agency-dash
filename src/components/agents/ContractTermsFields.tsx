import { useMemo, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  Briefcase,
  CalendarClock,
  CalendarDays,
  Coins,
  MapPinned,
  Percent,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UnitInput } from '@/components/ui/unit-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RegionPicker } from '@/components/common/RegionPicker';
import { InfoHint } from '@/components/common/InfoHint';
import {
  EMPLOYMENT_TYPES,
  REMITTANCE_CADENCES,
  cadenceLabel,
  employmentTypeLabel,
  parseRegions,
  splitRegions,
  switchFeeModel,
  type TermsForm,
} from '@/components/agents/contractTerms';
import { regionsFor, type RegionEntry } from '@/lib/regions';
import { cn } from '@/lib/utils';
import type { EmploymentType, FeeSplitModel, RemittanceCadence } from '@/types/agent.types';

/**
 * The inputs for a contract's terms, shared by the three surfaces that write
 * them: the offer on a request, a counter on a pending contract, and a proposal
 * on a live one. Layout-only — every rule about what may be sent where lives in
 * `contractTerms.ts` and in whichever dialog owns the save.
 *
 * `employment` is rendered only where it can be saved, because it is not a
 * negotiated term: it is the agency's own HR record, written unilaterally
 * through `PATCH .../employment` at any status. A request has no contract to
 * hang it on and a proposal would be refused with `403
 * CONTRACT_TERMS_NOT_NEGOTIABLE`, so both hide it.
 *
 * Every short, closed choice (fee model, cadence, weekday) is a row of tappable
 * options rather than a Select: on a phone a Select is open → scroll → tap, and
 * its popup lands on top of the very fields it governs.
 */

/**
 * A titled card of fields. `hint` is the group's explanation, behind an ⓘ that
 * opens it in a bottom sheet — these used to be a paragraph under every group,
 * which turned the editor into a page of prose with a few boxes in it.
 */
export function FieldGroup({
  title,
  hint,
  icon: Icon,
  children,
}: {
  title: string;
  hint?: ReactNode;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
        )}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint && <InfoHint title={title}>{hint}</InfoHint>}
      </div>
      {children}
    </section>
  );
}

/** One labelled input. `hint` goes behind an ⓘ beside the label, like {@link FieldGroup}'s. */
export function FormField({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex min-h-5 items-center gap-1.5">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        {hint && <InfoHint title={label}>{hint}</InfoHint>}
      </div>
      {children}
    </div>
  );
}

/**
 * A single choice as a group of buttons. Unlike `ChoiceChips`, labels may wrap:
 * "Toutes les deux semaines" in half a phone's width is two lines, not a clip.
 */
function OptionButtons<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
  itemClassName,
}: {
  label: string;
  value: T | '';
  options: readonly { value: T; label: ReactNode; ariaLabel?: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={className}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.ariaLabel}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex min-h-11 items-center justify-center rounded-xl border px-3 py-2 text-center text-sm leading-tight transition-all md:min-h-10',
              'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              'disabled:cursor-not-allowed disabled:opacity-60',
              selected
                ? 'border-primary bg-primary/10 font-medium text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary))]'
                : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground dark:bg-input/30',
              itemClassName,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const FEE_MODEL_OPTIONS: { value: FeeSplitModel; icon: LucideIcon; labelKey: string }[] = [
  { value: 'percentage', icon: Percent, labelKey: 'terms.fields.modelPercentage' },
  { value: 'flat', icon: Coins, labelKey: 'terms.fields.modelFlat' },
  { value: 'monthly_salary', icon: CalendarDays, labelKey: 'terms.fields.modelSalary' },
];

/** One-tap shares for the common case. Typing any other figure still works. */
const SHARE_PRESETS = [30, 40, 50, 60, 70];

/**
 * Weekdays in the active language, Monday first, keyed the way the API counts
 * them (`0` = Sunday). 2024-01-07 is a Sunday, so day `n` is the 7th plus `n`.
 */
function weekdayOptions(locale: string): { value: string; label: string; ariaLabel: string }[] {
  const short = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const long = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  return [1, 2, 3, 4, 5, 6, 0].map((day) => {
    const date = new Date(2024, 0, 7 + day);
    return { value: String(day), label: short.format(date), ariaLabel: long.format(date) };
  });
}

export interface ContractTermsFieldsProps {
  form: TermsForm;
  onChange: <K extends keyof TermsForm>(key: K, value: TermsForm[K]) => void;
  disabled?: boolean;
  /** Render the employment group. Only where `PATCH .../employment` is callable. */
  includeEmployment?: boolean;
  /**
   * The stored terms behind the form, when there are any. A conditional field
   * (day-of-week, flat fee) has to follow the *effective* model or cadence —
   * which is the stored value until the agency picks a different one — or it
   * disappears the moment the select is cleared.
   */
  seed?: TermsForm;
  /**
   * The agency's operating country, resolved through `useAgencyCountry()` —
   * NOT read straight off the session, which is `null` on every agency
   * provisioned before onboarding step 1 existed. Drives the region catalogue.
   *
   * Free text is the fallback only when this country has no regions on file at
   * all (any non-CM code today), never merely because the profile left it blank.
   */
  country?: string | null;
  /**
   * The agency's OWN declared `coverage_areas`, from the magazin. Marked in the
   * list so both parties can see which of the picked regions we actually serve —
   * never used to restrict the choice.
   */
  coverageAreas?: string[];
  /**
   * The catalogue to offer instead of the country's. Set from
   * `CONTRACT_COVERAGE_REGION_INVALID`'s `details.allowedRegions` so a rejected
   * save can be repaired from the error itself.
   */
  allowedRegions?: RegionEntry[];
}

export function ContractTermsFields({
  form,
  onChange,
  disabled = false,
  includeEmployment = false,
  seed,
  country,
  coverageAreas,
  allowedRegions,
}: ContractTermsFieldsProps) {
  const { t, i18n } = useTranslation('agents');
  const cadence = form.cadence || seed?.cadence || '';
  const feeModel = form.feeModel || seed?.feeModel || '';
  const currency = (form.currency || seed?.currency || 'XAF').toUpperCase();
  // The regions on offer. Resolved here rather than inside `RegionPicker` so the
  // same list decides BOTH what is rendered and what counts as a stray value —
  // and so an empty one (a country we hold no regions for) is what selects the
  // free-text fallback, instead of a blank `country` doing it.
  const catalogue = useMemo(
    () => allowedRegions ?? regionsFor(country, i18n.language),
    [allowedRegions, country, i18n.language],
  );
  // Stored values split into what the catalogue recognises and what it doesn't.
  // Legacy contracts hold free text like "Douala"; it is shown as a removable
  // chip rather than dropped, because the agency should see what is about to
  // stop being valid.
  const { known, unknown } = useMemo(
    () => splitRegions(form.regions, catalogue),
    [form.regions, catalogue],
  );
  const weekdays = useMemo(() => weekdayOptions(i18n.language), [i18n.language]);

  const pickFeeModel = (model: FeeSplitModel) => {
    // Picking a model clears the other models' amounts — they are never sent
    // beside it (that is a 400), so they must not linger on screen either.
    const changes = switchFeeModel(form, model, seed);
    for (const [key, value] of Object.entries(changes)) {
      onChange(key as keyof TermsForm, value as TermsForm[keyof TermsForm]);
    }
  };

  // The one amount input, shaped by the effective model.
  const amount =
    feeModel === 'monthly_salary'
      ? {
          field: 'monthlySalary' as const,
          label: t('terms.fields.monthlySalary'),
          placeholder: t('terms.fields.monthlySalaryPlaceholder'),
          unit: currency,
          min: 1,
        }
      : feeModel === 'flat'
        ? {
            field: 'flatFee' as const,
            label: t('terms.fields.flatFee'),
            placeholder: t('terms.fields.flatFeePlaceholder'),
            unit: currency,
            min: 0,
          }
        : {
            field: 'sharePercent' as const,
            label: t('terms.fields.sharePercent'),
            placeholder: t('terms.fields.sharePercentPlaceholder'),
            unit: '%',
            min: 0,
          };

  return (
    <div className="space-y-4">
      {includeEmployment && (
        <FieldGroup icon={Briefcase} title={t('terms.fields.employment')} hint={t('terms.fields.employmentHint')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t('terms.fields.employmentType')}>
              <Select
                value={form.empType}
                disabled={disabled}
                onValueChange={(v) => onChange('empType', v as EmploymentType)}
              >
                <SelectTrigger><SelectValue placeholder={t('terms.fields.emptySelect')} /></SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{employmentTypeLabel(type)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t('terms.fields.employmentRef')}>
              <Input
                value={form.empRef}
                disabled={disabled}
                onChange={(e) => onChange('empRef', e.target.value)}
                placeholder={t('terms.fields.employmentRefPlaceholder')}
              />
            </FormField>
            <FormField label={t('terms.fields.employmentStarted')}>
              <Input type="date" value={form.empStart} disabled={disabled} onChange={(e) => onChange('empStart', e.target.value)} />
            </FormField>
            <FormField label={t('terms.fields.employmentEnds')}>
              <Input type="date" value={form.empEnd} disabled={disabled} onChange={(e) => onChange('empEnd', e.target.value)} />
            </FormField>
          </div>
        </FieldGroup>
      )}

      {/* Fee split — what this agent is paid per delivery */}
      <FieldGroup
        icon={Wallet}
        title={t('terms.fields.feeSplit')}
        hint={
          // The per-delivery hint ("the cut comes out of your fee, the platform
          // pays it") is false for a salary — Wi-Mall pays nothing there.
          <Trans
            ns="agents"
            i18nKey={feeModel === 'monthly_salary' ? 'terms.fields.salaryHint' : 'terms.fields.feeSplitHint'}
            components={{ strong: <span className="font-medium text-foreground" /> }}
          />
        }
      >
        <OptionButtons
          label={t('terms.fields.model')}
          value={feeModel as FeeSplitModel | ''}
          disabled={disabled}
          onChange={pickFeeModel}
          className="grid grid-cols-3 gap-2"
          itemClassName="min-h-[4.5rem] flex-col gap-1.5 px-2 md:min-h-[4.5rem]"
          options={FEE_MODEL_OPTIONS.map(({ value, icon: Icon, labelKey }) => ({
            value,
            label: (
              <>
                <Icon className="size-5" />
                <span className="text-xs sm:text-sm">{t(labelKey as 'terms.fields.modelPercentage')}</span>
              </>
            ),
          }))}
        />

        <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
          <FormField label={amount.label}>
            <UnitInput
              // Keyed on the field so switching model never carries the
              // browser's half-typed state across to another amount.
              key={amount.field}
              type="number"
              min={amount.min}
              max={amount.field === 'sharePercent' ? 100 : undefined}
              step={amount.field === 'monthlySalary' ? 1 : undefined}
              inputMode={amount.field === 'sharePercent' ? 'decimal' : 'numeric'}
              unit={amount.unit}
              value={form[amount.field]}
              disabled={disabled}
              onChange={(e) => onChange(amount.field, e.target.value)}
              placeholder={amount.placeholder}
              className="text-lg font-semibold tabular-nums md:text-base"
            />
          </FormField>
          <FormField label={t('terms.fields.currency')}>
            <Input
              value={form.currency}
              maxLength={3}
              disabled={disabled}
              onChange={(e) => onChange('currency', e.target.value.toUpperCase())}
              placeholder={t('terms.fields.currencyPlaceholder')}
              className="text-center font-medium uppercase tracking-wider"
            />
          </FormField>
        </div>

        {amount.field === 'sharePercent' && !disabled && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('terms.fields.sharePercent')}>
            {SHARE_PRESETS.map((preset) => {
              const active = form.sharePercent === String(preset);
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange('sharePercent', String(preset))}
                  className={cn(
                    'h-8 rounded-full border px-3 text-xs font-medium tabular-nums transition-colors',
                    'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {preset} %
                </button>
              );
            })}
          </div>
        )}
      </FieldGroup>

      {/* Remittance cadence */}
      <FieldGroup icon={CalendarClock} title={t('terms.fields.remittance')} hint={t('terms.fields.remittanceHint')}>
        <FormField label={t('terms.fields.cadence')}>
          <OptionButtons
            label={t('terms.fields.cadence')}
            value={cadence as RemittanceCadence | ''}
            disabled={disabled}
            onChange={(v) => onChange('cadence', v)}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            options={REMITTANCE_CADENCES.map((value) => ({ value, label: cadenceLabel(value) }))}
          />
        </FormField>

        {['weekly', 'biweekly'].includes(cadence) && (
          // Named days, not a 0–6 box with "0 = Sunday" under it. The value
          // stays the API's index, so the payload builders are unchanged.
          <FormField label={t('terms.fields.dayOfWeek')}>
            <OptionButtons
              label={t('terms.fields.dayOfWeek')}
              value={form.dayOfWeek}
              disabled={disabled}
              onChange={(v) => onChange('dayOfWeek', v)}
              // One row of seven, always — a wrapping row strands Sunday on a
              // full-width line of its own.
              className="grid grid-cols-7 gap-1.5"
              itemClassName="min-w-0 overflow-hidden px-0 text-xs capitalize sm:text-sm"
              options={weekdays}
            />
          </FormField>
        )}

        <div className="grid grid-cols-2 gap-3">
          {cadence === 'monthly' && (
            <FormField label={t('terms.fields.dayOfMonth')}>
              <Input
                type="number"
                min={1}
                max={28}
                inputMode="numeric"
                value={form.dayOfMonth}
                disabled={disabled}
                onChange={(e) => onChange('dayOfMonth', e.target.value)}
                placeholder={t('terms.fields.dayOfMonthHint')}
              />
            </FormField>
          )}
          <FormField label={t('terms.fields.graceHours')}>
            <UnitInput
              type="number"
              min={0}
              max={720}
              inputMode="numeric"
              unit="h"
              value={form.graceHours}
              disabled={disabled}
              onChange={(e) => onChange('graceHours', e.target.value)}
              placeholder={t('terms.fields.graceHoursPlaceholder')}
            />
          </FormField>
        </div>
      </FieldGroup>

      <FieldGroup icon={MapPinned} title={t('terms.fields.coverage')}>
        <FormField label={t('terms.fields.regions')} hint={t('terms.fields.regionsHint')}>
          {catalogue.length > 0 ? (
            <RegionPicker
              value={known}
              onChange={(next) => onChange('regions', [...next, ...unknown])}
              country={country}
              disabled={disabled}
              options={catalogue}
              // Scoped to the COUNTRY, not to what we already serve: an agency
              // contracts agents for a region it is expanding into before it
              // declares it. So our own areas are marked, and the rest stay
              // clickable.
              highlightKeys={coverageAreas}
              highlightLabel={t('terms.coverage.yoursBadge')}
              unknownValues={unknown}
              onRemoveUnknown={(raw) =>
                onChange('regions', form.regions.filter((r) => r !== raw))
              }
              emptyHint={t('terms.values.allRegions')}
            />
          ) : (
            // No regions on file for this country, so there is nothing to pick
            // from — free text is the only honest control, and the backend skips
            // its region check for exactly this case. Uncontrolled, or a
            // trailing ", " would be eaten mid-typing.
            <Input
              defaultValue={form.regions.join(', ')}
              disabled={disabled}
              onChange={(e) => onChange('regions', parseRegions(e.target.value))}
              placeholder={t('terms.fields.regionsPlaceholder')}
            />
          )}
        </FormField>
        <FormField label={t('terms.fields.ceiling')} hint={t('terms.fields.ceilingHint')}>
          <UnitInput
            type="number"
            min={0}
            inputMode="numeric"
            unit={currency}
            value={form.ceiling}
            disabled={disabled}
            onChange={(e) => onChange('ceiling', e.target.value)}
            placeholder={t('terms.fields.ceilingPlaceholder')}
          />
        </FormField>
      </FieldGroup>
    </div>
  );
}
