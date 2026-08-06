import { z } from 'zod';
import type { AnyTFunction } from '@/i18n/tx';
import { phoneIssue, type CountryCode, type PhoneIssue } from '@/lib/phone';

/**
 * Zod schemas whose messages are localized.
 *
 * A Zod schema built at module scope would freeze its messages in whichever
 * language was active at import time, so every schema here is a *factory* that
 * takes `t`. Call it from a component with
 * `useMemo(() => buildXSchema(t), [t])` and the resolver re-binds when the
 * language changes.
 *
 * Keys are always addressed with an explicit `validation:` prefix, so the `t`
 * that is passed in may be bound to any namespace — what matters is that its
 * identity changes on a language switch, which is what re-triggers the
 * caller's `useMemo`.
 */

type T = AnyTFunction;

const v = (t: T, key: string, options?: Record<string, unknown>): string =>
  t(`validation:${key}` as never, options as never) as unknown as string;

// ─── Password (PATCH /me/password — see api-doc/me/password.md) ───────────────

export function buildPasswordSchema(t: T) {
  return z
    .object({
      oldPassword: z.string().min(1, v(t, 'password.currentRequired')),
      newPassword: z
        .string()
        .min(8, v(t, 'password.minLength'))
        .regex(/[A-Z]/, v(t, 'password.uppercase'))
        .regex(/[a-z]/, v(t, 'password.lowercase'))
        .regex(/[0-9]/, v(t, 'password.number'))
        .regex(/[^A-Za-z0-9]/, v(t, 'password.special')),
      confirmPassword: z.string(),
    })
    .refine((value) => value.newPassword === value.confirmPassword, {
      message: v(t, 'password.mismatch'),
      path: ['confirmPassword'],
    });
}

export type PasswordFormValues = z.infer<ReturnType<typeof buildPasswordSchema>>;

// ─── Phone (E.164 — see lib/phone.ts) ─────────────────────────────────────────

/**
 * The message for a rejected phone number. Every phone field in the app renders
 * this one — a hand-rolled form calls it with `phoneIssue(...)`, a Zod form gets
 * it through `buildPhoneSchema` — so "what's wrong with this number" reads the
 * same in onboarding, settings and checkout.
 */
export function phoneErrorMessage(t: T, issue: PhoneIssue): string {
  return v(t, `phone.${issue}`);
}

/**
 * A phone field, validated against the numbering rules of the country the value
 * names. The value is E.164; `country` only interprets a legacy row stored
 * without a `+` before this was so.
 *
 * `required: false` lets `''` through, which is how a clearable field is emptied
 * — a non-empty value is checked either way.
 */
export function buildPhoneSchema(
  t: T,
  options: { required?: boolean; country?: CountryCode | null } = {},
) {
  const { required = true, country = null } = options;
  return z.string().superRefine((value, ctx) => {
    const issue = phoneIssue(value, { required, country });
    if (issue) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: phoneErrorMessage(t, issue) });
    }
  });
}

export { v as validationMessage };
