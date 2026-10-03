/**
 * The `fee_split` write rules (api-doc/FRONTEND-CHANGELOG-contract-salary.md).
 *
 * A body that names a `model` must carry ONLY that model's amount — another
 * model's amount non-null beside it is a `400`. The salary model makes that
 * easy to get wrong: a contract switched to `monthly_salary` still holds its old
 * share server-side, and a form that echoed it would be refused.
 */
import { describe, it, expect, vi } from 'vitest';

// Pure logic under test — keep i18next, the region catalogue and Intl out of it.
vi.mock('@/i18n/tx', () => ({ txStatic: (key: string) => key }));
vi.mock('@/lib/regions', () => ({ regionsFor: () => [] }));

import {
  blankTermsForm,
  buildNegotiablePayload,
  buildOfferPayload,
  feeSplitError,
  seedTermsForm,
  switchFeeModel,
  type TermsForm,
} from './contractTerms';
import type { AgentMembership, ContractFeeSplit, FeeSplitModel } from '@/types/agent.types';

function membership(feeSplit: ContractFeeSplit): AgentMembership {
  return {
    employment: { employmentType: null, employeeRef: null, startedAt: null, endsAt: null },
    feeSplit,
    remittanceTerms: { cadence: 'weekly', dayOfWeek: null, dayOfMonth: null, graceHours: 24 },
    coverage: { regions: [], area: null },
    shipmentValueCeiling: null,
  } as unknown as AgentMembership;
}

const PERCENTAGE: ContractFeeSplit = {
  model: 'percentage',
  agentSharePercent: 70,
  agentFlatFee: null,
  agentMonthlySalary: null,
  currency: 'XAF',
};

/** The form after the agency picks `model` in the select, the way the field does it. */
function pick(form: TermsForm, model: FeeSplitModel, seed?: TermsForm): TermsForm {
  return { ...form, ...switchFeeModel(form, model, seed) };
}

describe('buildOfferPayload', () => {
  it('monthly_salary sends agent_monthly_salary and no share or flat amount', () => {
    const form = { ...pick({ ...blankTermsForm(), sharePercent: '40' }, 'monthly_salary'), monthlySalary: '150000' };
    expect(buildOfferPayload(form).fee_split).toEqual({
      model: 'monthly_salary',
      agent_monthly_salary: 150000,
      currency: 'XAF',
    });
  });

  it('even a lingering share value is not sent beside monthly_salary', () => {
    const form: TermsForm = { ...blankTermsForm(), feeModel: 'monthly_salary', sharePercent: '40', monthlySalary: '1' };
    const split = buildOfferPayload(form).fee_split!;
    expect(split).not.toHaveProperty('agent_share_percent');
    expect(split).not.toHaveProperty('agent_flat_fee');
    expect(split.agent_monthly_salary).toBe(1);
  });

  it('switching back to percentage drops the salary', () => {
    let form = { ...pick(blankTermsForm(), 'monthly_salary'), monthlySalary: '150000' };
    form = { ...pick(form, 'percentage'), sharePercent: '40' };
    expect(form.monthlySalary).toBe('');
    expect(buildOfferPayload(form).fee_split).toEqual({
      model: 'percentage',
      agent_share_percent: 40,
      currency: 'XAF',
    });
  });

  it('flat sends only agent_flat_fee', () => {
    const form: TermsForm = { ...blankTermsForm(), feeModel: 'flat', flatFee: '1500', monthlySalary: '9' };
    expect(buildOfferPayload(form).fee_split).toEqual({ model: 'flat', agent_flat_fee: 1500, currency: 'XAF' });
  });
});

describe('buildNegotiablePayload', () => {
  it('a switch to monthly_salary sends the model and salary, never the stored share', () => {
    const seed = seedTermsForm(membership(PERCENTAGE));
    const form = { ...pick(seed, 'monthly_salary', seed), monthlySalary: '150000' };
    expect(form.sharePercent).toBe('');
    expect(buildNegotiablePayload(form, seed).fee_split).toEqual({
      model: 'monthly_salary',
      agent_monthly_salary: 150000,
    });
  });

  it('a salaried contract switched back to percentage drops the salary', () => {
    const seed = seedTermsForm(
      membership({ ...PERCENTAGE, model: 'monthly_salary', agentMonthlySalary: 150000 }),
    );
    const form = { ...pick(seed, 'percentage', seed), sharePercent: '35' };
    expect(buildNegotiablePayload(form, seed).fee_split).toEqual({
      model: 'percentage',
      agent_share_percent: 35,
    });
  });

  it('a raise on a salaried contract sends only the new salary', () => {
    const seed = seedTermsForm(
      membership({ ...PERCENTAGE, model: 'monthly_salary', agentMonthlySalary: 150000 }),
    );
    expect(buildNegotiablePayload({ ...seed, monthlySalary: '175000' }, seed).fee_split).toEqual({
      agent_monthly_salary: 175000,
    });
  });
});

describe('seedTermsForm', () => {
  it('ignores a stale share beside monthly_salary', () => {
    const seed = seedTermsForm(
      membership({ ...PERCENTAGE, model: 'monthly_salary', agentSharePercent: 70, agentMonthlySalary: 150000 }),
    );
    expect(seed.sharePercent).toBe('');
    expect(seed.monthlySalary).toBe('150000');
  });
});

describe('feeSplitError', () => {
  it('requires a positive whole salary under monthly_salary', () => {
    const blank = blankTermsForm();
    const salaried: TermsForm = { ...blank, feeModel: 'monthly_salary' };
    expect(feeSplitError(salaried, blank)).toBe('agents:terms.errors.salaryNeedsAmount');
    expect(feeSplitError({ ...salaried, monthlySalary: '0' }, blank)).toBe('agents:terms.errors.salaryInvalid');
    expect(feeSplitError({ ...salaried, monthlySalary: '1.5' }, blank)).toBe('agents:terms.errors.salaryInvalid');
    expect(feeSplitError({ ...salaried, monthlySalary: '150000' }, blank)).toBeNull();
  });
});
