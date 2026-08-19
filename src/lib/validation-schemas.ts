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

// ─── Sign in (POST /auth/login — see api-doc/auth/README.md) ──────────────────

/**
 * The backend takes a single `identifier` that may be a phone number OR an
 * email, discriminated server-side by the presence of an `@`. The form asks
 * which one is being entered, because a phone needs a country selector and E.164
 * normalisation while an email must get neither — one field cannot honestly be
 * both.
 *
 * `identifier_type` drives the UI only and is stripped before submit.
 */
export const IDENTIFIER_TYPES = ['phone', 'email'] as const;
export type IdentifierType = (typeof IDENTIFIER_TYPES)[number];

/**
 * Ported from the landing site's `LoginSchema`, with one difference in each
 * direction:
 *
 * - No E.164 transform. There, the field held whatever was typed; here
 *   `PhoneInput` already emits E.164, so re-normalising would be converting a
 *   value that is already converted.
 * - **Password is presence-only, not min 6.** Login's own server rule is
 *   `min(1)` — the min-6 belongs to *registration* (`RegisterSchema`). Enforcing
 *   6 here would refuse a credential the API would have accepted, locking out
 *   any account whose password predates that rule, with a message that reads
 *   like our bug rather than their password.
 */
export function buildLoginSchema(t: T, options: { country?: CountryCode | null } = {}) {
  return z
    .object({
      identifier_type: z.enum(IDENTIFIER_TYPES),
      identifier: z.string().trim(),
      password: z.string().min(1, v(t, 'password.required')),
    })
    .superRefine((data, ctx) => {
      if (data.identifier_type === 'phone') {
        const issue = phoneIssue(data.identifier, { required: true, country: options.country });
        if (issue) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: phoneErrorMessage(t, issue),
            path: ['identifier'],
          });
        }
        return;
      }

      if (!data.identifier) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: v(t, 'required'),
          path: ['identifier'],
        });
        return;
      }
      if (!z.string().email().safeParse(data.identifier).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: v(t, 'email'),
          path: ['identifier'],
        });
      }
    });
}

export type LoginFormValues = z.infer<ReturnType<typeof buildLoginSchema>>;

// ─── Forgot password (POST /auth/forgot-password) ─────────────────────────────

/**
 * One field, presence-checked and nothing more.
 *
 * The endpoint accepts an email or an E.164 phone in the same field. Guessing
 * which one was typed in order to reject the other is exactly how a legitimate
 * identifier gets refused before it is ever sent — so the only client-side rule
 * is that something was entered. A malformed value comes back as a 400 naming
 * the problem, which is a statement about the input and leaks nothing about who
 * holds an account.
 */
export function buildForgotPasswordSchema(t: T) {
  return z.object({
    identifier: z.string().trim().min(1, v(t, 'required')),
  });
}

export type ForgotPasswordFormValues = z.infer<ReturnType<typeof buildForgotPasswordSchema>>;

// ─── Registration (POST /auth/register — see api-doc/auth/README.md) ──────────

export const AGENCY_NAME_MIN = 2;
/** Also the input's `maxLength`, so the cap is felt while typing, not on submit. */
export const AGENCY_NAME_MAX = 100;

/**
 * Agency sign-up. Ported from the landing site's `RegisterSchema`, reduced to
 * the one role this dashboard creates — no role branching, because `role` is
 * fixed to `'agency'` in `authService.register`.
 *
 * Two rules are stricter here than on the server, on purpose:
 *
 * - **`agency_name` is bounded 2–100 client-side, and the endpoint bounds it not
 *   at all.** `RegisterSchema` server-side is a bare `z.string().optional()`;
 *   what actually happens is that `deriveMagazinName` appends `" Agency"` to
 *   anything under 2 characters and truncates the rest at 100 — silently, with a
 *   201 either way. Without these bounds, the name typed is not the name saved.
 * - **`name` is required at 2 characters**, matching the server. It is the
 *   *person*, and it lands on the role profile as `display_name`; the business's
 *   own name is `agency_name`, which seeds a separate Magazin document. That is
 *   also why the returned `role_entity` carries no `agency_name`.
 *
 * `password` is min 6 — registration's rule. Note this is *looser* than a
 * password reset, which is held to 8 with complexity (`PasswordStrengthSchema`).
 * The two genuinely disagree server-side; each form follows the endpoint it
 * posts to.
 *
 * `email` is optional for agencies (vendors are the ones who must supply one).
 */
export function buildRegisterSchema(t: T, options: { country?: CountryCode | null } = {}) {
  return z.object({
    phone: buildPhoneSchema(t, { required: true, country: options.country }),
    name: z.string().trim().min(1, v(t, 'name.required')).min(2, v(t, 'name.tooShort')),
    agency_name: z
      .string()
      .trim()
      .min(1, v(t, 'magazin.nameRequired'))
      .min(AGENCY_NAME_MIN, v(t, 'magazin.nameTooShort'))
      .max(AGENCY_NAME_MAX, v(t, 'magazin.nameTooLong')),
    // `.or(z.literal(''))` rather than a plain `.optional()`: an untouched field
    // holds `''`, and `z.string().email()` would reject that as malformed.
    email: z.string().trim().email(v(t, 'email')).optional().or(z.literal('')),
    password: z.string().min(6, v(t, 'password.signUpMinLength')),
  });
}

export type RegisterFormValues = z.infer<ReturnType<typeof buildRegisterSchema>>;

export { v as validationMessage };
