import * as React from 'react';

import { cn } from '@/lib/utils';

interface UnitInputProps extends React.ComponentProps<'input'> {
  /** Shown inside the field after the value, e.g. "days" or "%". */
  unit: string;
  invalid?: boolean;
  /** Classes for the visible box (height, width). `className` goes to the input. */
  wrapperClassName?: string;
}

/**
 * A number field that carries its unit inside the box ("14 days", "80 %"),
 * so the label can stay short — "Return window" rather than
 * "Return window (days)". Takes `ref` like a plain input (react-hook-form's
 * `register` works as-is).
 */
export function UnitInput({ unit, invalid, wrapperClassName, className, ...props }: UnitInputProps) {
  return (
    <div
      className={cn(
        'flex h-11 w-full items-center rounded-lg border border-input md:h-10 shadow-xs transition-[color,box-shadow] dark:bg-input/30',
        'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
        invalid && 'border-destructive',
        wrapperClassName,
      )}
    >
      <input
        aria-invalid={invalid || undefined}
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent ps-3.5 pe-2 text-base outline-none placeholder:text-muted-foreground md:text-sm',
          className,
        )}
        {...props}
      />
      <span className="shrink-0 select-none pe-3.5 text-sm text-muted-foreground">
        {unit}
      </span>
    </div>
  );
}
