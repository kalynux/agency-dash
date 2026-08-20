import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useDefaultPhoneCountry } from '@/hooks/useDefaultPhoneCountry';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  formatNationalDisplay,
  formatNationalInput,
  parseIncompletePhoneNumber,
  parsePhone,
  phoneCountryOptions,
  phoneDigits,
  phoneExample,
  toE164,
  type CountryCode,
} from '@/lib/phone';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

/**
 * The phone field. Every phone number the agency types goes through this.
 *
 * A country selector sits ahead of the number, and the two together produce one
 * **E.164 string** (`+237671234567`) — that is what `value`/`onChange` carry,
 * what forms hold, and what reaches the API. The visible text is national
 * grouping (`6 71 23 45 67`) and exists only on screen; nothing downstream ever
 * has to strip a space or guess a country code. Validation belongs to the
 * surrounding form — `buildPhoneSchema` / `phoneIssue` in `lib/phone` — so a
 * field can be required here and optional there while the message stays the same.
 *
 * The picker opens on the agency's own country (`useDefaultPhoneCountry`) and
 * stays free: pasting or typing a `+…` number retunes the selector to whatever
 * country that number belongs to, and picking a country re-groups the digits
 * already typed under the new numbering plan.
 *
 * Two details that are the difference between usable and not:
 *  - **Caret preservation.** Re-formatting on every keystroke would fling the
 *    caret to the end on any mid-string edit, so the caret is re-placed by
 *    counting *digits* rather than characters.
 *  - **Separator deletion.** Backspacing over a grouping space removes no digit,
 *    so a naive re-format would put the space straight back and the key would
 *    appear dead. That case is detected and eats the digit before it instead.
 */

export type PhoneInputVariant = 'default' | 'onboarding';

export interface PhoneInputProps {
  /** E.164, or `''`. While the number is unfinished this is a prefix of one. */
  value: string;
  /** Fired with the new E.164 value — `''` when the field is emptied. */
  onChange: (value: string) => void;
  onBlur?: () => void;
  /**
   * ISO-2 the picker opens on when `value` names no country of its own.
   * Defaults to the agency's operating country. Pass this only where the session
   * cannot answer yet (onboarding step 1, which is where the country is set).
   */
  defaultCountry?: string | null;
  /** Lands on the number input, so a `<Label htmlFor>` labels the right control. */
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  /** Paints the error state and sets `aria-invalid` on the number input. */
  hasError?: boolean;
  /** Id of the element carrying this field's error / hint text. */
  describedBy?: string;
  /** Accessible name for the number input where there is no visible `<Label>`. */
  ariaLabel?: string;
  autoFocus?: boolean;
  /** `onboarding` matches the wizard's taller, tinted fields. */
  variant?: PhoneInputVariant;
  className?: string;
}

const SHELL_BASE =
  'flex w-full items-center overflow-hidden rounded-lg border transition-[color,box-shadow,border-color] focus-within:ring-[3px]';

const SHELL_VARIANT: Record<PhoneInputVariant, string> = {
  default:
    'h-10 border-input bg-transparent shadow-xs dark:bg-input/30 hover:border-input/70 focus-within:border-ring focus-within:ring-ring/40',
  onboarding:
    'h-11 border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 focus-within:border-primary focus-within:ring-primary/30',
};

const SHELL_ERROR: Record<PhoneInputVariant, string> = {
  default: 'border-destructive ring-destructive/20 dark:ring-destructive/40',
  onboarding: 'border-red-400 focus-within:border-red-400 focus-within:ring-red-200',
};

const INPUT_VARIANT: Record<PhoneInputVariant, string> = {
  default: 'text-base md:text-sm placeholder:text-muted-foreground',
  onboarding: 'text-sm text-slate-900 dark:text-white placeholder:text-slate-400',
};

/** Index in `text` just after its `count`-th digit — the caret's real anchor. */
function indexAfterDigits(text: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) >= 48 && text.charCodeAt(i) <= 57) {
      seen += 1;
      if (seen === count) return i + 1;
    }
  }
  return text.length;
}

/**
 * The country a value *names for itself*, or `null` when it doesn't name one.
 *
 * Only a `+…` value pins the picker. An empty field and a legacy row stored in
 * local format both leave it free to follow the agency's country as the session
 * resolves it.
 */
function pinnedCountryOf(value: string): CountryCode | null {
  return value.trim().startsWith('+') ? parsePhone(value, null).country : null;
}

/** Local state for a given outside `value` — the picker's pin and the visible text. */
function seedFrom(value: string, fallback: CountryCode): { country: CountryCode | null; text: string } {
  return {
    country: pinnedCountryOf(value),
    text: formatNationalDisplay(value, fallback),
  };
}

export function PhoneInput({
  value,
  onChange,
  onBlur,
  defaultCountry,
  id,
  name,
  placeholder,
  disabled,
  required,
  hasError,
  describedBy,
  ariaLabel,
  autoFocus,
  variant = 'default',
  className,
}: PhoneInputProps) {
  const { t, i18n } = useTranslation('common');
  const fallbackCountry = useDefaultPhoneCountry(defaultCountry);
  // Drives the country picker only: a 200-row list is a bottom sheet on a phone
  // and a popover beside the field on desktop.
  const isMobile = useIsMobile();

  const [open, setOpen] = useState(false);
  /** `null` = follow `fallbackCountry`; set once the value or the user names one. */
  const [pickedCountry, setPickedCountry] = useState<CountryCode | null>(() =>
    pinnedCountryOf(value),
  );
  const [text, setText] = useState(() => seedFrom(value, fallbackCountry).text);
  /** The `value` our state was last built from — our own echo included. */
  const [syncedValue, setSyncedValue] = useState(value);

  const inputRef = useRef<HTMLInputElement>(null);
  /** Caret to restore after a re-format, as a character index into the new text. */
  const caret = useRef<number | null>(null);
  /** Picking a country should hand focus on to the number, not back to the trigger. */
  const focusNumberOnClose = useRef(false);

  const country = pickedCountry ?? fallbackCountry;

  // Re-seed when `value` changes from the outside — a form reset, a Discard, a
  // record finishing its load. Adjusting state during render rather than in an
  // effect, so there is no throwaway paint of the stale number:
  // https://react.dev/learn/you-might-not-need-an-effect
  if (value !== syncedValue) {
    const seed = seedFrom(value, fallbackCountry);
    setSyncedValue(value);
    setPickedCountry(seed.country);
    setText(seed.text);
  }

  const countries = useMemo(() => phoneCountryOptions(i18n.language), [i18n.language]);
  const selected = useMemo(
    () => countries.find((option) => option.code === country),
    [countries, country],
  );

  useLayoutEffect(() => {
    const position = caret.current;
    caret.current = null;
    if (position === null) return;
    const element = inputRef.current;
    if (element && document.activeElement === element) {
      element.setSelectionRange(position, position);
    }
  });

  const emit = useCallback(
    (next: string) => {
      setSyncedValue(next);
      if (next !== value) onChange(next);
    },
    [onChange, value],
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      const normalized = parseIncompletePhoneNumber(raw);

      // A `+…` number carries its own country — adopt it as soon as the prefix
      // is unambiguous, and until then leave the text exactly as typed so the
      // digits don't appear to vanish mid-code.
      if (normalized.startsWith('+')) {
        const parsed = parsePhone(normalized, null);
        if (parsed.country) {
          setPickedCountry(parsed.country);
          // A pasted number is a stored one as far as grouping goes.
          setText(formatNationalDisplay(normalized, parsed.country));
          emit(toE164(parsed.country, parsed.nationalNumber));
        } else {
          setText(normalized);
          emit(normalized);
        }
        return;
      }

      const selectionEnd = event.target.selectionStart ?? raw.length;
      let digits = phoneDigits(normalized);
      let digitsBeforeCaret = phoneDigits(raw.slice(0, selectionEnd)).length;

      // Backspacing a grouping character removes no digit; re-formatting would
      // put it straight back. Take the digit in front of the caret instead.
      if (raw.length < text.length && digits === phoneDigits(text) && digitsBeforeCaret > 0) {
        digits = digits.slice(0, digitsBeforeCaret - 1) + digits.slice(digitsBeforeCaret);
        digitsBeforeCaret -= 1;
      }

      const formatted = formatNationalInput(country, digits);
      caret.current = indexAfterDigits(formatted, digitsBeforeCaret);
      setText(formatted);
      emit(toE164(country, digits));
    },
    [country, emit, text],
  );

  const pickCountry = useCallback(
    (next: CountryCode) => {
      focusNumberOnClose.current = true;
      setOpen(false);
      setPickedCountry(next);
      // The digits already typed are re-grouped under the new numbering plan.
      const formatted = formatNationalInput(next, text);
      setText(formatted);
      emit(toE164(next, formatted));
    },
    [emit, text],
  );

  const dialCode = selected ? `+${selected.callingCode}` : '';
  const countryName = selected?.name ?? country;
  const hint = useMemo(() => placeholder ?? phoneExample(country), [placeholder, country]);

  /**
   * Radix hands focus back to the trigger on close, which is right for Escape
   * but wrong right after a pick — the number is what they came here to type.
   * Shared by both panels so the two behave identically.
   */
  const returnFocusToNumber = (event: Event) => {
    if (!focusNumberOnClose.current) return;
    focusNumberOnClose.current = false;
    event.preventDefault();
    inputRef.current?.focus();
  };

  /**
   * The flag + dial-code button, identical either way. A function rather than a
   * variable because the popover branch hands it to `PopoverTrigger asChild`
   * (which attaches its own handler) while the sheet branch has to supply one.
   */
  const countryTrigger = (props: { onClick?: () => void } = {}) => (
    <button
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-label={t('phone.countryFor', { country: countryName, code: dialCode })}
      disabled={disabled}
      className={cn(
        'flex h-full shrink-0 items-center gap-1.5 ps-3 pe-2 outline-none',
        'hover:bg-muted/60 focus-visible:bg-muted/60 disabled:cursor-not-allowed',
      )}
      {...props}
    >
      <span aria-hidden className="text-base leading-none">
        {selected?.flag}
      </span>
      <span dir="ltr" className="text-sm tabular-nums text-muted-foreground">
        {dialCode}
      </span>
      <ChevronsUpDown aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-50" />
    </button>
  );

  /**
   * The searchable list, shared by the popover and the sheet.
   *
   * `Command` comes along for the ride on mobile rather than being replaced by
   * `ResponsiveSelect`: its filter matches `option.search`, which carries each
   * country's aliases ("Côte d'Ivoire" under "Ivory Coast"), and that is worth
   * more here than anywhere else in the app — the list is 200 rows long and
   * scrolling it is not a real option on a phone.
   *
   * `dense === false` is the desktop row. On mobile the rows grow to a thumb
   * target and the text goes up a step, since the same list is now the whole
   * panel rather than a dropdown beside a form.
   */
  const countryList = (dense: boolean) => (
    <Command className="h-full">
      <CommandInput placeholder={t('phone.searchCountry')} />
      <CommandList className={dense ? 'max-h-none' : undefined}>
        <CommandEmpty>{t('phone.noCountry')}</CommandEmpty>
        <CommandGroup>
          {countries.map((option) => (
            <CommandItem
              key={option.code}
              value={option.search}
              onSelect={() => pickCountry(option.code)}
              className={cn(dense && 'min-h-12 gap-3 text-base')}
            >
              <span aria-hidden className="text-base leading-none">
                {option.flag}
              </span>
              <span className="min-w-0 flex-1 truncate">{option.name}</span>
              <span dir="ltr" className="text-xs tabular-nums text-muted-foreground">
                +{option.callingCode}
              </span>
              <Check
                aria-hidden
                className={cn(
                  'h-4 w-4 shrink-0',
                  option.code === country ? 'opacity-100' : 'opacity-0',
                )}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  return (
    <div
      className={cn(
        SHELL_BASE,
        SHELL_VARIANT[variant],
        hasError && SHELL_ERROR[variant],
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      {isMobile ? (
        <>
          {countryTrigger({ onClick: () => setOpen(true) })}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent
              side="bottom"
              // Tall and fixed rather than content-sized: this list is ~200 rows
              // long whatever the filter says, and a panel that resized as you
              // typed would move the row you were reaching for.
              className="flex h-[75dvh] flex-col gap-0 rounded-t-2xl p-0"
              onCloseAutoFocus={returnFocusToNumber}
            >
              <SheetHeader className="shrink-0 border-b p-4 pe-10 text-start">
                <SheetTitle className="text-base">{t('phone.searchCountry')}</SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">
                {countryList(true)}
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{countryTrigger()}</PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[min(20rem,calc(100vw-2rem))] p-0"
            onCloseAutoFocus={returnFocusToNumber}
          >
            {countryList(false)}
          </PopoverContent>
        </Popover>
      )}

      <span aria-hidden className="h-5 w-px shrink-0 bg-border" />

      <input
        ref={inputRef}
        id={id}
        name={name}
        type="tel"
        dir="ltr"
        inputMode="tel"
        autoComplete="tel-national"
        autoFocus={autoFocus}
        disabled={disabled}
        value={text}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder={hint}
        aria-invalid={hasError || undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        className={cn(
          'h-full w-full min-w-0 bg-transparent px-3 text-start outline-none',
          'disabled:cursor-not-allowed',
          INPUT_VARIANT[variant],
        )}
      />
    </div>
  );
}
