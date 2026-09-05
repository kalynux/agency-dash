/**
 * Value equality for the settings forms — "has the user actually changed
 * anything, right now?".
 *
 * Every settings tab shows its floating `UnsavedChangesBar` while the live form
 * differs from the last values the server is known to hold. That check has to
 * survive a round trip through the DOM, and a plain `JSON.stringify` diff does
 * not, in two ways that both surface as a Save bar that will not go away after
 * the user undoes their own edit:
 *
 *  - React Hook Form stores whatever the input element hands back, so an
 *    `<Input type="number">` seeded from the number `500` holds the *string*
 *    `"500"` the moment it is touched — including when the user deletes a digit
 *    and types the same one back.
 *  - "Nothing here" arrives as `''`, `null`, `undefined`, or an absent key
 *    depending on which side of the round trip you read: zod's `.optional()`
 *    drops a blank field entirely, the DOM reports `''`, and the backend
 *    answers `null`.
 *
 * So blank-ish values are all equal to one another, a number equals its own
 * decimal string, strings compare trimmed (every string in these payloads is
 * `.trim()`ed by the schema before it is sent), and objects compare over the
 * union of their keys so a missing key reads as blank rather than as a change.
 *
 * Deliberately NOT symmetric with `JSON.stringify`: `0` is a real value and is
 * never equal to blank — clearing a fee to empty and typing `0` are different
 * edits, and both must show the bar.
 */
export function isSameFormValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  const aBlank = isBlank(a);
  const bBlank = isBlank(b);
  if (aBlank || bBlank) return aBlank && bBlank;

  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim();

  // number ↔ numeric string: the touched-number-input case above. Only applied
  // across types, so two strings ("0012345" vs "12345" — an account number) are
  // still compared as text.
  if (typeof a === 'number' && typeof b === 'string') return numberEqualsString(a, b);
  if (typeof b === 'number' && typeof a === 'string') return numberEqualsString(b, a);

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => isSameFormValue(item, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    for (const key of keys) {
      const left = (a as Record<string, unknown>)[key];
      const right = (b as Record<string, unknown>)[key];
      if (!isSameFormValue(left, right)) return false;
    }
    return true;
  }

  return false;
}

/** The inverse, for the common `dirty` read. */
export function hasFormChanged(current: unknown, baseline: unknown): boolean {
  return !isSameFormValue(current, baseline);
}

function isBlank(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  // A number input holding an unparseable value reports NaN — treat it as empty
  // rather than as a value that differs from everything including itself.
  return typeof v === 'number' && Number.isNaN(v);
}

function numberEqualsString(n: number, s: string): boolean {
  const parsed = Number(s.trim());
  return !Number.isNaN(parsed) && parsed === n;
}
