// The negotiated terms of an agent contract, as a form.
//
// Three surfaces write these figures and they must agree on every rule, so the
// shape, the seeding, the diffing and the fee-split check live here rather than
// in whichever dialog happened to need them first:
//
//   • the offer attached to `POST /agency/agents/requests` — no contract exists
//     yet, so it seeds blank;
//   • a counter on a `pending` contract (`POST .../counter`), written straight
//     onto the contract document;
//   • a proposal on a live one (`POST .../terms-proposals`), staged behind the
//     agent's answer while the agreed terms stay in force.
//
// `employment` rides along in the form but NOT in the negotiable payload: it is
// the agency's own HR record, written unilaterally at any status through
// `PATCH .../employment`. Sending it as a term is `403
// CONTRACT_TERMS_NOT_NEGOTIABLE`. `cod.threshold` is likewise its own endpoint.

import { readContractTerms } from '@/types/agent.types';
import { txStatic } from '@/i18n/tx';
import type {
  AgentMembership,
  EmploymentType,
  FeeSplitModel,
  NegotiableTermsPayload,
  RemittanceCadence,
  UpdateEmploymentPayload,
} from '@/types/agent.types';

export const EMPLOYMENT_TYPES: EmploymentType[] = ['employee', 'contractor', 'freelancer'];

/**
 * Cadence values in display order. The copy lives in `agents:terms.cadences.*` —
 * this module is imported at boot, so a label baked in here would freeze in the
 * language that happened to be active then.
 */
export const REMITTANCE_CADENCES: RemittanceCadence[] = [
  'per_delivery',
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'on_demand',
];

export function cadenceLabel(cadence: string): string {
  const key = `agents:terms.cadences.${cadence}`;
  const translated = txStatic(key);
  return translated === key ? cadence : translated;
}

export function employmentTypeLabel(type: string): string {
  const key = `agents:terms.employmentTypes.${type}`;
  const translated = txStatic(key);
  return translated === key ? type : translated;
}

/**
 * Every field is a string so an untouched input stays untouched: payloads are
 * diffed against the seeded values and only changed groups are sent, which is
 * what makes the endpoint's field-by-field merge safe to rely on.
 */
export interface TermsForm {
  empType: EmploymentType | '';
  empRef: string;
  empStart: string;
  empEnd: string;
  feeModel: FeeSplitModel | '';
  sharePercent: string;
  flatFee: string;
  currency: string;
  cadence: RemittanceCadence | '';
  dayOfWeek: string;
  dayOfMonth: string;
  graceHours: string;
  /** `coverage.regions`, comma-separated. The polygon `area` is not editable here. */
  regions: string;
  ceiling: string;
}

function num(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

/** Split a comma-separated region list into trimmed, non-empty names. */
export function parseRegions(value: string): string[] {
  return value.split(',').map((r) => r.trim()).filter(Boolean);
}

export function seedTermsForm(membership: AgentMembership): TermsForm {
  const { feeSplit, remittanceTerms, coverage, shipmentValueCeiling } = readContractTerms(membership);
  return {
    empType: membership.employment.employmentType ?? '',
    empRef: membership.employment.employeeRef ?? '',
    empStart: membership.employment.startedAt?.slice(0, 10) ?? '',
    empEnd: membership.employment.endsAt?.slice(0, 10) ?? '',
    feeModel: feeSplit.model,
    sharePercent: num(feeSplit.agentSharePercent),
    flatFee: num(feeSplit.agentFlatFee),
    currency: feeSplit.currency,
    cadence: remittanceTerms.cadence,
    dayOfWeek: num(remittanceTerms.dayOfWeek),
    dayOfMonth: num(remittanceTerms.dayOfMonth),
    graceHours: num(remittanceTerms.graceHours),
    regions: coverage.regions.join(', '),
    ceiling: num(shipmentValueCeiling),
  };
}

/**
 * A blank offer for an agent we have no contract with, pre-set to the shape most
 * offers take. There is nothing to diff against here, so
 * {@link buildOfferPayload} sends the figures outright.
 */
export function blankTermsForm(): TermsForm {
  return {
    empType: '',
    empRef: '',
    empStart: '',
    empEnd: '',
    feeModel: 'percentage',
    sharePercent: '',
    flatFee: '',
    currency: 'XAF',
    cadence: 'weekly',
    dayOfWeek: '',
    dayOfMonth: '',
    graceHours: '',
    regions: '',
    ceiling: '',
  };
}

/** The employment group only — written unilaterally, never negotiated. */
export function buildEmploymentPayload(form: TermsForm, seed: TermsForm): UpdateEmploymentPayload {
  const employment: UpdateEmploymentPayload = {};
  if (form.empType && form.empType !== seed.empType) employment.employment_type = form.empType;
  // `employee_ref` is clearable: an emptied input is an explicit null.
  if (form.empRef.trim() !== seed.empRef) employment.employee_ref = form.empRef.trim() || null;
  if (form.empStart !== seed.empStart) employment.started_at = form.empStart || null;
  if (form.empEnd !== seed.empEnd) employment.ends_at = form.empEnd || null;
  return employment;
}

/** Only the negotiated groups the agency actually changed, as the endpoints expect. */
export function buildNegotiablePayload(form: TermsForm, seed: TermsForm): NegotiableTermsPayload {
  const payload: NegotiableTermsPayload = {};

  const feeSplit: NonNullable<NegotiableTermsPayload['fee_split']> = {};
  if (form.feeModel && form.feeModel !== seed.feeModel) feeSplit.model = form.feeModel;
  if (form.sharePercent !== seed.sharePercent && form.sharePercent !== '') {
    feeSplit.agent_share_percent = Number(form.sharePercent);
  }
  if (form.flatFee !== seed.flatFee && form.flatFee !== '') {
    feeSplit.agent_flat_fee = Number(form.flatFee);
  }
  const currency = form.currency.trim().toUpperCase();
  if (currency && currency !== seed.currency.toUpperCase()) feeSplit.currency = currency;
  if (Object.keys(feeSplit).length > 0) payload.fee_split = feeSplit;

  const remittance: NonNullable<NegotiableTermsPayload['remittance_terms']> = {};
  if (form.cadence && form.cadence !== seed.cadence) remittance.cadence = form.cadence;
  if (form.dayOfWeek !== seed.dayOfWeek && form.dayOfWeek !== '') {
    remittance.day_of_week = Number(form.dayOfWeek);
  }
  if (form.dayOfMonth !== seed.dayOfMonth && form.dayOfMonth !== '') {
    remittance.day_of_month = Number(form.dayOfMonth);
  }
  if (form.graceHours !== seed.graceHours && form.graceHours !== '') {
    remittance.grace_hours = Number(form.graceHours);
  }
  if (Object.keys(remittance).length > 0) payload.remittance_terms = remittance;

  // `area` is deliberately left alone — a polygon is not something this text
  // editor can express, and omitting the key keeps whatever is stored.
  if (form.regions !== seed.regions) {
    payload.coverage = { regions: parseRegions(form.regions) };
  }

  // Nullable on purpose — an emptied ceiling means "no per-shipment cap".
  if (form.ceiling !== seed.ceiling) {
    payload.shipment_value_ceiling = form.ceiling.trim() === '' ? null : Number(form.ceiling);
  }

  return payload;
}

/**
 * The opening offer on `POST /agency/agents/requests`. Unlike the others this is
 * not a diff: there is no stored contract behind it, so whatever the agency
 * typed is what the agent is being offered.
 */
export function buildOfferPayload(form: TermsForm): NegotiableTermsPayload {
  const payload: NegotiableTermsPayload = { fee_split: {} };
  const feeSplit = payload.fee_split!;

  if (form.feeModel) feeSplit.model = form.feeModel;
  if (form.feeModel === 'flat') {
    if (form.flatFee !== '') feeSplit.agent_flat_fee = Number(form.flatFee);
  } else if (form.sharePercent !== '') {
    feeSplit.agent_share_percent = Number(form.sharePercent);
  }
  const currency = form.currency.trim().toUpperCase();
  if (currency) feeSplit.currency = currency;

  if (form.cadence) {
    const remittance: NonNullable<NegotiableTermsPayload['remittance_terms']> = {
      cadence: form.cadence,
    };
    if (form.dayOfWeek !== '') remittance.day_of_week = Number(form.dayOfWeek);
    if (form.dayOfMonth !== '') remittance.day_of_month = Number(form.dayOfMonth);
    if (form.graceHours !== '') remittance.grace_hours = Number(form.graceHours);
    payload.remittance_terms = remittance;
  }

  const regions = parseRegions(form.regions);
  if (regions.length > 0) payload.coverage = { regions };

  if (form.ceiling.trim() !== '') payload.shipment_value_ceiling = Number(form.ceiling);

  return payload;
}

/**
 * The one rule the server enforces up front: the split that RESULTS from the
 * patch must carry a value for its model, because the earnings pipeline divides
 * by it twice — once for the agent's offer-time estimate, once for the actual at
 * delivery. Checked here too so a mistyped split is caught before it can mispay
 * anyone, and mirrored on `approve`, where a contract can never go live carrying
 * a split that cannot pay.
 */
export function feeSplitError(form: TermsForm, seed: TermsForm): string | null {
  const model = form.feeModel || seed.feeModel;
  if (model === 'percentage' && !(form.sharePercent || seed.sharePercent)) {
    return txStatic('agents:terms.errors.percentageNeedsShare');
  }
  if (model === 'flat' && !(form.flatFee || seed.flatFee)) {
    return txStatic('agents:terms.errors.flatNeedsFee');
  }
  if (form.sharePercent !== '' && (Number(form.sharePercent) < 0 || Number(form.sharePercent) > 100)) {
    return txStatic('agents:terms.errors.shareOutOfRange');
  }
  return null;
}

/** One-line summary of a contract's agreed terms, for a collapsed section header. */
export function summarizeTerms(membership: AgentMembership): string {
  return [
    membership.employment.employmentType
      ? employmentTypeLabel(membership.employment.employmentType)
      : '',
    membership.feeSplit.model === 'flat'
      ? txStatic('agents:terms.summaryFlat', { amount: membership.feeSplit.agentFlatFee ?? 0 })
      : txStatic('agents:terms.summaryShare', { percent: membership.feeSplit.agentSharePercent ?? 0 }),
    cadenceLabel(membership.remittanceTerms.cadence),
  ]
    .filter(Boolean)
    .join(' · ');
}

// ─── Rendering a proposal's diff ────────────────────────────────────────────────
// `TermsDiffEntry.path` is dotted within the term groups, snake_case like the
// write bodies (`fee_split.agent_share_percent`), and `shipment_value_ceiling`
// is a scalar group that appears at its bare name.

export function termPathLabel(path: string): string {
  // The dot in a path is i18next's nesting separator, so the whole path is one
  // JSON key under `paths` — hence the bracket lookup rather than a nested tree.
  const key = `agents:terms.paths.${path}`;
  const translated = txStatic(key);
  return translated === key ? path.replace(/[._]/g, ' ') : translated;
}

/** A diff leaf as display text. Nulls read as their meaning, not as "null". */
export function termValueText(path: string, value: unknown): string {
  if (value == null || value === '') {
    return path === 'shipment_value_ceiling'
      ? txStatic('agents:terms.values.noCap')
      : txStatic('agents:terms.values.notSet');
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : txStatic('agents:terms.values.none');
  }
  if (path === 'remittance_terms.cadence') return cadenceLabel(String(value));
  if (typeof value === 'object') return txStatic('agents:terms.values.mapArea');
  return String(value);
}
