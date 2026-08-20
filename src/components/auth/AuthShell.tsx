import type { ReactNode } from 'react';
import { AppLogo } from '@/components/common/AppLogo';
import { LanguagePicker } from '@/components/common/LanguagePicker';
import { cn } from '@/lib/utils';

/**
 * The frame every auth screen sits in — sign in, registration, password reset.
 *
 * These are the only screens in the app that render outside the dashboard
 * chrome, so they own their own page background and safe-area padding: there is
 * no Sidebar or Header above them to have handled it. On a device this is a
 * full-bleed screen, and without the insets the card sits under the status bar.
 *
 * Composition follows the landing site's `AuthCard` (logo, titled header rule,
 * body, footer link) rebuilt on this app's tokens, so someone who signs in on
 * wi-mall.com and then here does not meet two different products.
 */
interface AuthShellProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Sits below the card — the "back to sign in" / "create an account" line. */
  footer?: ReactNode;
  className?: string;
}

export function AuthShell({ title, subtitle, children, footer, className }: AuthShellProps) {
  return (
    <div
      className={cn(
        'flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted',
        'px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]',
      )}
    >
      <div className={cn('w-full max-w-md', className)}>
        {/* Above the logo, not tucked in a corner: this is the first screen of a
            freshly downloaded app, and for anyone who cannot read the form
            below it is the only control on the page that matters. In flow
            rather than absolutely positioned so it can never land under the
            status bar on a device drawing edge to edge. */}
        <div className="mb-3 flex justify-end">
          <LanguagePicker />
        </div>

        <div className="mb-6 flex justify-center">
          <AppLogo size="lg" className="shadow-sm" />
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm">
          <div className="border-b px-6 pb-4 pt-6 sm:px-8">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="px-6 py-6 sm:px-8">{children}</div>
        </div>

        {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
      </div>
    </div>
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
