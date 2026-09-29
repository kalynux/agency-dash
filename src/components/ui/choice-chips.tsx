import { cn } from '@/lib/utils';

interface ChoiceChipsProps<T extends string> {
  value: T | null | undefined;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  /** Accessible name for the group — usually the field's label text. */
  label: string;
  id?: string;
  className?: string;
}

/**
 * A single choice shown as a row of buttons, for questions with two or three
 * short answers. Replaces a Select there: every answer is visible at once and
 * picking one is a single tap instead of open → scroll → tap.
 *
 * The buttons share the row equally and wrap onto a second line rather than
 * squeezing a label, so a long translation never gets cut off.
 */
export function ChoiceChips<T extends string>({
  value,
  onChange,
  options,
  label,
  id,
  className,
}: ChoiceChipsProps<T>) {
  return (
    <div id={id} role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-11 grow basis-0 whitespace-nowrap rounded-lg border px-3 text-sm transition-colors md:h-10',
              'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              selected
                ? 'border-primary bg-primary/10 font-medium text-foreground'
                : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground dark:bg-input/30',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
