import { cn } from '@/lib/utils';

/**
 * Turning a Radix popper surface into a bottom sheet, below `md`.
 *
 * Ported from the vendor dashboard (same file there), where every ⓘ on a phone
 * opens as a sheet from the bottom edge rather than a 12px popup hanging off a
 * 14px icon.
 *
 * ── Why this is styling and not a second component ───────────────────────────
 *
 * The obvious way to get a bottom sheet on mobile is to render a `Sheet` instead
 * of the popover — and it is a trap. Popover carries the behaviour that is the
 * actual product: dismiss on outside press, focus return, collision handling on
 * desktop. A parallel mobile implementation re-earns every one of those and
 * drifts from the desktop one the first time a bug is fixed in only one of them.
 * So the primitive stays what it was and only its *presentation* changes.
 *
 * ── The two things that made this non-obvious ────────────────────────────────
 *
 * ⚠ **`!important` beats an animation.** Pinning the content to the bottom of
 * the screen means stripping every transform on it, and an `!important` author
 * declaration outranks a running animation — do it on the element the sheet is
 * drawn on and `slide-in-from-bottom` silently does nothing.
 *
 * ⚠ **The popper's own transform is NOT on the content.** Radix puts its inline
 * `translate(x, y)` (and, at 1.5x density and up, `will-change: transform`) on
 * a `[data-radix-popper-content-wrapper]` around the content. Either makes that
 * wrapper the containing block for the content's `position: fixed`, and the
 * sheet collapses to zero width at the trigger. `index.css` undoes both on any
 * wrapper holding a `[data-mobile-sheet]` element.
 *
 * Hence two elements rather than one. The Radix element becomes an invisible
 * *positioning shell* — pinned, transparent, transform killed — and a plain
 * wrapper inside it is the surface that has the background, the radius and the
 * slide. It reads the open/closed state off the shell through
 * `group-data-[state=…]`, which is why the shell always carries `group`.
 *
 * On `md` and up the wrapper is `display: contents` — it stops generating a box
 * at all, every class on it goes inert, and the desktop popup is exactly what it
 * was.
 *
 * The class tokens are in `./mobile-sheet.styles`.
 */

/** The visible sheet. `md:contents` is what keeps desktop untouched. */
export function MobileSheetPanel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'md:contents',
        'flex max-h-[75dvh] w-full flex-col overflow-hidden',
        'rounded-t-2xl border-t bg-popover text-popover-foreground',
        // Lifted off the page rather than outlined — a bottom sheet reads as a
        // layer above the app, and a plain border reads as part of it.
        'shadow-[0_-10px_40px_-12px_rgb(0_0_0/0.35)]',
        'group-data-[state=open]:animate-in group-data-[state=open]:slide-in-from-bottom-full group-data-[state=open]:duration-300',
        'group-data-[state=closed]:animate-out group-data-[state=closed]:slide-out-to-bottom-full group-data-[state=closed]:duration-200',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The grab bar. Purely a signifier — the sheet is dismissed by tapping outside,
 * which Radix already handles. A panel that slides up with no handle reads as a
 * stuck menu.
 */
export function MobileSheetHandle({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('flex shrink-0 justify-center pb-1 pt-2.5 md:hidden', className)}>
      <span className="h-1 w-9 rounded-full bg-muted-foreground/30" />
    </div>
  );
}

/**
 * The dim behind the sheet, in a `Popover.Portal` of its own.
 *
 * Popover's root is **non-modal**: nothing stops a press from reaching the page,
 * so a scrim that ignored the pointer would dismiss the sheet *and* press
 * whatever was under the thumb. Here the scrim is a real surface that swallows
 * the press, and because it is genuinely outside the content that press is an
 * outside-press — so it closes the sheet with no handler of its own.
 *
 * ⚠ Never as a second child of the content's portal: `Popover.Portal` is
 * `<Portal asChild>`, a Slot takes exactly one child, and a second one throws
 * `React.Children.only` and takes the route down.
 *
 * `z-50`, not the vendor dashboard's `z-40`: here ⓘs also live inside the
 * inventory detail sheet, which is itself `z-50`. Portalled after that sheet and
 * before the popover content, an equal index stacks it between the two by DOM
 * order — dimming the sheet, under the hint.
 */
export function MobileSheetPortalScrim({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('fixed inset-0 z-50 bg-black/40 animate-in fade-in-0 md:hidden', className)}
    />
  );
}
