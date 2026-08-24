import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { AppLogo } from '@/components/common/AppLogo';
import { LanguagePicker } from '@/components/common/LanguagePicker';
import { cn } from '@/lib/utils';

/**
 * The frame every auth screen sits in — sign in, registration, password reset.
 *
 * These are the only screens in the app that render outside the dashboard
 * chrome, so they own their own page background and safe-area padding: there is
 * no Sidebar or Header above them to have handled it.
 *
 * ⚠ The top inset is only half the story on Android. `env(safe-area-inset-top)`
 * reports `0px` on every WebView older than 140, whatever the real status bar
 * measures — so this padding alone put the language picker underneath the clock
 * and the battery. What actually keeps the page clear of the bar is
 * `src/platform/shell/statusBar.ts` declining the overlay; the inset here is
 * what handles the versions where the app *does* draw edge to edge. Read that
 * file before touching either.
 *
 * **A centred card, matching Wi-Vendor.** The two dashboards are the same
 * product to anyone who runs both, and their sign-in screens are the first thing
 * they see of either — so the composition is shared verbatim: platform mark,
 * centred heading, the form on a card, the "no account?" line beneath it.
 *
 * ⚠ **The card is centred with `my-auto`, never `justify-center`.** They look
 * identical right up until the content is taller than the viewport — which the
 * six-field registration form is on any phone — and then they differ in the way
 * that matters: `justify-center` overflows a flex container *equally at both
 * ends*, so the top of the form is pushed above the container's own padding, out
 * from under the safe-area inset and behind the status bar, where no amount of
 * scrolling can reach it. Auto margins only consume *positive* free space, so
 * the card centres when it fits and falls back to the padding edge when it does
 * not.
 */
interface AuthShellProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Sits below the card — the "back to sign in" / "create an account" line. */
  footer?: ReactNode;
  /** Applied to the centred column, not the card. */
  className?: string;
}

export function AuthShell({ title, subtitle, children, footer, className }: AuthShellProps) {
  return (
    <div
      className={cn(
        'flex min-h-screen flex-col items-center bg-gradient-to-br from-background to-muted',
        'px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]',
      )}
    >
      {/* Aligned to the card's right edge rather than the viewport's, so on a
          tablet it reads as part of the same column instead of drifting off
          into the margin. In flow rather than absolutely positioned so it moves
          with the safe-area padding instead of having to repeat it.

          It stays outside the card on purpose: for someone who cannot read the
          language the app guessed, this is the only control on the screen they
          can act on, and it should not be buried in the form it exists to make
          readable. */}
      <div className="flex w-full max-w-sm justify-end">
        <LanguagePicker />
      </div>

      <div className={cn('my-auto w-full max-w-sm space-y-6 pt-2', className)}>
        <div className="flex flex-col items-center gap-3 text-center">
          {/* Announced, not decorative: the heading says "Welcome back", not
              which product you are signing in to, so the mark is the only thing
              on the screen that names the platform. */}
          <AppLogo size="lg" className="shadow-sm" />
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-balance text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">{children}</div>

        {footer && <p className="text-center text-sm text-muted-foreground">{footer}</p>}
      </div>
    </div>
  );
}

/**
 * A text link styled as the inline call-to-action on an auth screen. Extracted
 * only because all three screens need one and they should not drift apart.
 */
export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </Link>
  );
}

/**
 * The one place a failed submit is announced on these screens.
 *
 * `role="alert"` rather than a toast: a sign-in failure is about the form the
 * user is looking at, and a toast that auto-dismisses is the wrong home for the
 * message that says why they cannot get in.
 */
export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
    >
      {message}
    </div>
  );
}
