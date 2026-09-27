import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * One labelled control in a cash-form sheet (record a deposit, declare a
 * remittance, raise a discrepancy).
 *
 * The forms used to be a row of placeholder-only inputs; inside a sheet there
 * is room for a real label, which stays visible once the field is filled —
 * exactly when a placeholder disappears.
 */
export function CashFormField({
  label,
  htmlFor,
  optional,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  optional?: boolean;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation('common');
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="flex items-baseline gap-1.5">
        {label}
        {optional && (
          <span className="text-xs font-normal text-muted-foreground">{t('form.optional')}</span>
        )}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
