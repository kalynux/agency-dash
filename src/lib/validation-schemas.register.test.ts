import { describe, expect, it } from 'vitest';
import type { AnyTFunction } from '@/i18n/tx';
import { buildRegisterSchema } from './validation-schemas';

// Echo the key, so assertions name the message rather than its copy.
const t = ((key: string) => key) as unknown as AnyTFunction;

const valid = {
  name: 'Amina Nkeng',
  agency_name: 'Nkeng Logistics',
  phone: '+237652705926',
  email: '',
  password: 'secret1',
  confirmPassword: 'secret1',
  terms_accepted: true,
};

describe('buildRegisterSchema — terms consent', () => {
  const schema = buildRegisterSchema(t);

  it('accepts a sign-up with the box ticked', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it('rejects an unticked box, on the terms_accepted field', () => {
    const result = schema.safeParse({ ...valid, terms_accepted: false });
    expect(result.success).toBe(false);
    const issue = result.error!.issues.find((i) => i.path.join('.') === 'terms_accepted');
    expect(issue?.message).toBe('validation:terms.required');
  });

  it('rejects a missing consent', () => {
    const { terms_accepted: _omitted, ...rest } = valid;
    void _omitted;
    expect(schema.safeParse(rest).success).toBe(false);
  });
});
