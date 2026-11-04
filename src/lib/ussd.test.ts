import { describe, expect, it } from 'vitest';

import { ussdTelHref } from './ussd';

describe('ussdTelHref', () => {
  it('encodes # so it does not start the fragment, and leaves * alone', () => {
    expect(ussdTelHref('#150*50#')).toBe('tel:%23150*50%23');
    expect(ussdTelHref('*126#')).toBe('tel:*126%23');
  });

  it('parses back to the code the payer has to dial', () => {
    const url = new URL(ussdTelHref('#150*50#'));
    expect(url.hash).toBe('');
    expect(decodeURIComponent(url.pathname)).toBe('#150*50#');
  });

  it('ignores whitespace around the code', () => {
    expect(ussdTelHref(' *126# ')).toBe('tel:*126%23');
  });
});
