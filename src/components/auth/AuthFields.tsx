import type { ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';

/**
 * The form pieces the auth screens share.
 *
 * Extracted once sign-in and registration had to agree field for field: they are
 * two halves of the same first impression, and a label that carries a required
 * marker on one screen and not the other is the kind of drift nobody notices
 * until both are on screen at once.
 */

/**
 * A field label, with the required marker the auth forms put on every mandatory
 * field.
 *
 * The asterisk is redundant to a screen reader — the inputs carry their own
 * `aria-invalid` and the resolver rejects an empty one — so it is `aria-hidden`
 * rather than read out as "star".
 */
export function FieldLabel({
  htmlFor,
  required = false,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      {required && (
        <span aria-hidden className="text-destructive">
          *
        </span>
      )}
    </Label>
  );
}

/**
 * The line under a field: its error if it has one, otherwise its hint.
 *
 * One element, never both — they occupy the same slot, and a hint left sitting
 * under a rejected value is advice about a field that has already failed. `id`
 * is the target of the input's `aria-describedby` either way, so the association
 * survives the swap.
 */
export function FieldMessage({
  id,
  error,
  hint,
}: {
  id: string;
  error?: string;
  hint?: ReactNode;
}) {
  if (error) {
    return (
      <p id={id} role="alert" className="text-xs text-destructive">
        {error}
      </p>
    );
  }
  if (!hint) return null;
  return (
    <p id={id} className="text-xs text-muted-foreground">
      {hint}
    </p>
  );
}

/**
 * A labelled password field, reveal toggle and message line included.
 *
 * The toggle itself is `PasswordInput` rather than a copy of it: the eye has to
 * behave the same here as it does on Settings → Security, and it is the control
 * that already handles the RTL inset. This wrapper only adds what a *form* field
 * needs around it — the label with its required marker, and the hint/error slot.
 *
 * `autoComplete` is required rather than defaulted: `current-password` and
 * `new-password` mean different things to a password manager, and getting them
 * the wrong way round is how a manager offers to overwrite a working credential.
 */
export function PasswordField({
  id,
  label,
  placeholder,
  hint,
  error,
  autoComplete,
  registration,
}: {
  id: string;
  label: string;
  placeholder?: string;
  hint?: string;
  /** Already resolved to prose by the caller. */
  error?: string;
  autoComplete: 'current-password' | 'new-password';
  registration: UseFormRegisterReturn;
}) {
  const messageId = `${id}-message`;

  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={id} required>
        {label}
      </FieldLabel>
      <PasswordInput
        id={id}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-11"
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? messageId : undefined}
        {...registration}
      />
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}
