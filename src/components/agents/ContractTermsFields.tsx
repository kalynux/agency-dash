import { useMemo, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RegionPicker } from '@/components/common/RegionPicker';
import {
  EMPLOYMENT_TYPES,
  REMITTANCE_CADENCES,
  cadenceLabel,
  employmentTypeLabel,
  parseRegions,
  splitRegions,
  type TermsForm,
} from '@/components/agents/contractTerms';
import { regionsFor, type RegionEntry } from '@/lib/regions';
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
 */

export function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

export function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
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

  return (
    <div className="space-y-5">
      {includeEmployment && (
        <FieldGroup title={t('terms.fields.employment')}>
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
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t('terms.fields.employmentHint')}
          </p>
        </FieldGroup>
      )}

      {/* Fee split — what this agent is paid per delivery */}
      <FieldGroup title={t('terms.fields.feeSplit')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={t('terms.fields.model')}>
            <Select
              value={form.feeModel}
              disabled={disabled}
              onValueChange={(v) => onChange('feeModel', v as FeeSplitModel)}
            >
              <SelectTrigger><SelectValue placeholder={t('terms.fields.emptySelect')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">{t('terms.fields.modelPercentage')}</SelectItem>
                <SelectItem value="flat">{t('terms.fields.modelFlat')}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {feeModel === 'flat' ? (
            <FormField label={t('terms.fields.flatFee')}>
              <Input
                type="number"
                min={0}
                value={form.flatFee}
                disabled={disabled}
                onChange={(e) => onChange('flatFee', e.target.value)}
                placeholder={t('terms.fields.flatFeePlaceholder')}
              />
            </FormField>
          ) : (
            <FormField label={t('terms.fields.sharePercent')}>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.sharePercent}
                disabled={disabled}
                onChange={(e) => onChange('sharePercent', e.target.value)}
                placeholder={t('terms.fields.sharePercentPlaceholder')}
              />
            </FormField>
          )}
          <FormField label={t('terms.fields.currency')}>
            <Input
              value={form.currency}
              maxLength={3}
              disabled={disabled}
              onChange={(e) => onChange('currency', e.target.value.toUpperCase())}
              placeholder={t('terms.fields.currencyPlaceholder')}
            />
          </FormField>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <Trans
            ns="agents"
            i18nKey="terms.fields.feeSplitHint"
            components={{ strong: <span className="font-medium" /> }}
          />
        </p>
      </FieldGroup>

      {/* Remittance cadence */}
      <FieldGroup title={t('terms.fields.remittance')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={t('terms.fields.cadence')}>
            <Select
              value={form.cadence}
              disabled={disabled}
              onValueChange={(v) => onChange('cadence', v as RemittanceCadence)}
            >
              <SelectTrigger><SelectValue placeholder={t('terms.fields.emptySelect')} /></SelectTrigger>
              <SelectContent>
                {REMITTANCE_CADENCES.map((value) => (
                  <SelectItem key={value} value={value}>{cadenceLabel(value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t('terms.fields.graceHours')}>
            <Input
              type="number"
              min={0}
              max={720}
              value={form.graceHours}
              disabled={disabled}
              onChange={(e) => onChange('graceHours', e.target.value)}
              placeholder={t('terms.fields.graceHoursPlaceholder')}
            />
          </FormField>
          {['weekly', 'biweekly'].includes(cadence) && (
            <FormField label={t('terms.fields.dayOfWeek')} hint={t('terms.fields.dayOfWeekHint')}>
              <Input
                type="number"
                min={0}
                max={6}
                value={form.dayOfWeek}
                disabled={disabled}
                onChange={(e) => onChange('dayOfWeek', e.target.value)}
              />
            </FormField>
          )}
          {cadence === 'monthly' && (
            <FormField label={t('terms.fields.dayOfMonth')} hint={t('terms.fields.dayOfMonthHint')}>
              <Input
                type="number"
                min={1}
                max={28}
                value={form.dayOfMonth}
                disabled={disabled}
                onChange={(e) => onChange('dayOfMonth', e.target.value)}
              />
            </FormField>
          )}
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t('terms.fields.remittanceHint')}
        </p>
      </FieldGroup>

      <FieldGroup title={t('terms.fields.coverage')}>
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
          <Input
            type="number"
            min={0}
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
