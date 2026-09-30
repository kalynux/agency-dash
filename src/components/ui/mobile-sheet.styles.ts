import { cn } from '@/lib/utils';

/**
 * The class tokens that turn a Radix popper surface into a bottom sheet below
 * `md`. The components that go with them are in `./mobile-sheet.tsx`, which
 * carries the full rationale — read that first. Ported from the vendor
 * dashboard, so an ⓘ opens the same way in both apps.
 *
 * Split into its own module only because `react-refresh/only-export-components`
 * fails a file that exports both components and constants.
 */

/**
 * For the Radix content element itself. Pass *after* the component's own
 * classes so the `!important` overrides land last.
 */
export const mobileSheetShell = cn(
  // Read by the panel. Harmless on desktop.
  'group',
  // A shell, not a surface: no ground of its own, nothing to clip the sheet.
  'max-md:!border-0 max-md:!bg-transparent max-md:!p-0 max-md:!shadow-none',
  'max-md:!rounded-none max-md:!overflow-visible',
  // Pinned to the bottom edge, full width, free of every size Radix measured
  // for a popup that was going to hang off a trigger.
  'max-md:!fixed max-md:!inset-x-0 max-md:!bottom-0 max-md:!top-auto',
  'max-md:!m-0 max-md:!w-auto max-md:!min-w-0 max-md:!max-w-none max-md:!max-h-none',
  // ⚠ Kills every transform on the content, the enter animation's included —
  // a transform here would make it the containing block for anything fixed
  // inside it. This is exactly why the slide animation lives on the panel and
  // not here: an `!important` declaration outranks a running animation. The
  // popper's positioning transform is on the wrapper around this element and
  // is undone in index.css, keyed on `data-mobile-sheet`.
  'max-md:![transform:none]',
);

/**
 * Scroll region inside a sheet.
 *
 * Below `md` this is the thing that scrolls — the shell has given up its height.
 * On desktop the popup still scrolls itself, so this is inert there. The bottom
 * padding clears the gesture bar: a sheet that reaches the screen edge puts its
 * last line under the swipe-up strip.
 */
export const mobileSheetScrollArea = cn(
  'max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto max-md:overscroll-contain',
  'max-md:pb-[calc(0.5rem+env(safe-area-inset-bottom))]',
);
