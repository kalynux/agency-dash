import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * A password field with a reveal toggle.
 *
 * Typing a password you cannot see is a coin flip on a desktop keyboard and a
 * losing bet on a phone one — and a change-password form asks for three of them
 * in a row, where a single unseen typo is rejected without saying which field
 * was wrong. The sign-in and registration screens already had this control
 * inline; this is that same control, so the eye behaves the same wherever a
 * password is asked for.
 *
 * `tabIndex={-1}` on the toggle is deliberate: keyboard users tabbing from the
 * field expect the next FIELD, not a button whose job the browser already does
 * for them. It stays reachable by pointer, which is who it is for.
 *
 * Forwards its ref and every native prop, so it drops into `register()` from
 * React Hook Form exactly where an `<Input type="password">` used to be.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<'input'>, 'type'>
>(function PasswordInput({ className, ...props }, ref) {
  const { t } = useTranslation('common');
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        type={visible ? 'text' : 'password'}
        // Room for the toggle. `pe-` (padding-inline-end) rather than `pr-`, so
        // the field is still readable in Arabic, where the button is on the left.
        className={cn('pe-10', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('actions.hidePassword') : t('actions.showPassword')}
        aria-pressed={visible}
        tabIndex={-1}
        className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});
