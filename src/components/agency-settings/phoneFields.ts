/**
 * Thumb-sized form controls on a phone, applied once on a page wrapper instead
 * of on each of the many fields under it (same rule as the vendor dashboard).
 *
 * Below `md`, inputs and select triggers go from 40/36px to 44px with 16px type
 * (below which iOS zooms into a focused field), and select triggers fill the
 * row — a `w-fit` dropdown floating at the left of an otherwise full-width form
 * read as a mistake. `md` and up is untouched. A control that has to stay
 * compact on a phone opts out with `max-md:!h-9` / `max-md:!w-fit`.
 */
export const PHONE_FIELDS = [
  'max-md:[&_[data-slot=input]]:h-11',
  'max-md:[&_[data-slot=select-trigger]]:h-11',
  'max-md:[&_[data-slot=select-trigger]]:w-full',
  'max-md:[&_[data-slot=select-trigger]]:text-base',
].join(' ');
