/**
 * The two pinned bands at the top of every mobile screen, and the one number
 * that keeps them in step.
 *
 * On a phone the app is a stack of screens, not a scrolling document: the title
 * of what you are looking at, the way to act on it, and the way to search it
 * should not be things you have to scroll back up to reach. So `PageHeader`
 * pins itself under the status bar, and `SearchFilterBar` pins directly beneath
 * it.
 *
 * ### The offset is the contract
 *
 * The search row pins at exactly the height of the header's TITLE ROW (`h-14`),
 * not the header's full height — the description sits below the title row and
 * is deliberately left out of the reckoning. At rest everything is visible; once
 * the page scrolls, the search row slides up over the description and the two
 * pinned bands meet with no seam.
 *
 * That is why {@link mobileSearchBarClass} carries the HIGHER z-index of the
 * two. The bands overlap by exactly the description's height, and the search
 * row has to win that overlap — reversed, a one-line description would paint
 * over the search field the moment the user scrolled.
 *
 * ### Why the header is sticky and not its title row
 *
 * `position: sticky` is clipped to its own parent's box: an element only stays
 * pinned while the box that contains it is still on screen. Pinning the title
 * row inside an ~80px header wrapper would hold for ~80px of scroll and then
 * leave with it. So the whole header is the sticky element and the page root —
 * which is as tall as the page — is its containing block.
 *
 * For the same reason nothing between here and `<body>` may set `overflow`
 * other than `visible`: an ancestor with a scroll port becomes the scroll
 * container, and both bands would pin to *it* rather than to the viewport.
 *
 * ⚠ The class strings below are written out in full, never assembled from
 * variables. Tailwind finds classes by scanning source text for literal
 * candidates, so `top-[${OFFSET}]` would compile to a rule that does not exist
 * — silently, and only in a production build. The title-row height therefore
 * appears twice: as `h-14` in {@link mobileAppBarTitleRowClass} and as `3.5rem`
 * inside the search row's `top-[calc(…)]`. They have to move together.
 *
 * ### Layering
 *
 * Header `z-20`, search row `z-30`. Both stay under the `z-40`
 * `StatusBarScrim` — which is what stops a pinned band painting over the clock
 * — and under every `z-50` overlay (tab bar, offline banner, sheets, dialogs).
 *
 * ### Full-bleed
 *
 * A pinned band has to cover the page's whole width, or content shows through
 * the gutter beside it. The negative margins mirror `CONTENT_FRAME` in App.tsx
 * (`px-4 sm:px-6`) and are re-applied as padding, exactly as `listSurfaceClass`
 * does; keep the three in sync.
 *
 * `env(safe-area-inset-top)` resolves to 0 in every desktop browser and in a
 * non-edge-to-edge WebView, so both offsets are plain `top-0` off a device.
 *
 * Everything here is `max-md:`-scoped, so the desktop shell — which has its own
 * `Header`, already sticky at `z-30` — is untouched.
 */

/** Full-bleed through the page gutter, then padded back in. */
const FULL_BLEED = 'max-md:-mx-4 max-md:px-4 sm:max-md:-mx-6 sm:max-md:px-6';

/**
 * The page header, pinned under the status bar.
 *
 * `bg-background` is opaque on purpose rather than the `bg-background/95
 * backdrop-blur` used elsewhere: a translucent bar still shows rows sliding
 * underneath it, which is the complaint rather than the cure.
 */
export const mobileAppBarClass =
  'max-md:sticky max-md:top-[env(safe-area-inset-top)] max-md:z-20 ' +
  'max-md:bg-background max-md:pb-2 max-md:border-b ' +
  FULL_BLEED;

/**
 * The header's title row. Its height is the offset the search row pins to, so
 * this stays a fixed `h-14` — see "The offset is the contract" above.
 */
export const mobileAppBarTitleRowClass = 'max-md:h-14';

/**
 * The search/filter row, pinned directly beneath the header's title row.
 *
 * The `calc` is the whole point: `3.5rem` is `h-14`, and adding the status-bar
 * inset lands exactly on the title row's bottom edge.
 */
export const mobileSearchBarClass =
  'max-md:sticky max-md:top-[calc(3.5rem+env(safe-area-inset-top))] max-md:z-30 ' +
  'max-md:bg-background max-md:py-2 max-md:border-b ' +
  FULL_BLEED;
