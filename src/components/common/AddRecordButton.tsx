import type { ElementType } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AddRecordButtonProps {
  label: string;
  onClick: () => void;
  icon?: ElementType;
  variant?: 'default' | 'destructive';
  className?: string;
}

/**
 * The "create one" button that sits at the end of a list's `SearchFilterBar`
 * row (pass it as `trailing`).
 *
 * Same 44px height and radius as the search field and filter button beside it,
 * so the row stays one shape. Below `md` it collapses to a square `+` button —
 * the search field needs the width more than the label does, and the label
 * stays as the accessible name.
 */
export function AddRecordButton({
  label,
  onClick,
  icon: Icon = Plus,
  variant = 'default',
  className,
}: AddRecordButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={onClick}
      className={cn('h-11 flex-shrink-0 gap-2 rounded-xl px-4 max-md:w-11 max-md:px-0', className)}
    >
      {/* Alone on a phone, a domain icon (coins, a paper plane) does not say
          "add"; a plus does. Beside its label on desktop, the specific icon
          reads fine and tells the three tabs apart. */}
      <Plus className="h-[1.15rem] w-[1.15rem] md:hidden" />
      <Icon className="h-[1.15rem] w-[1.15rem] max-md:hidden" />
      <span className="max-md:sr-only">{label}</span>
    </Button>
  );
}
