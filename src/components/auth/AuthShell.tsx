import type { ReactNode } from 'react';
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
 * **No card.** The form sits directly on the page. On a phone a bordered panel
 * inside a full-bleed screen is a frame around nothing — it costs two gutters
 * of width and adds an edge that competes with the inputs' own. Composition is
 * still the landing site's (logo, title, body, footer link) so someone who signs
 * in on wi-mall.com and then here does not meet two different products.
 */
interface AuthShellProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Sits below the form — the "back to sign in" / "create an account" line. */
  footer?: ReactNode;
  className?: string;
}

export function AuthShell({ title, subtitle, children, footer, className }: AuthShellProps) {
  return (
    <div
      className={cn(
        'flex min-h-screen flex-col bg-gradient-to-br from-background to-muted',
        'px-5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]',
      )}
    >
      {/* Pinned to the page's top-right corner rather than to the form column:
          on this screen it is chrome, not part of the form, and the corner is
          where a language control is looked for. In flow rather than absolutely
          positioned so it moves with the safe-area padding instead of having to
          repeat it. */}
      <div className="flex justify-end">
        <LanguagePicker />
      </div>

      {/* `flex-1` + `justify-center` rather than centring the whole page: the
          picker above must stay at the top, and the form must stay centred in
          what is left. A page taller than the viewport simply scrolls. */}
      <div className={cn('mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6', className)}>
        <div className="mb-7 flex justify-center">
          <AppLogo size="lg" className="shadow-sm" />
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        {children}

        {footer && <div className="mt-8 text-center text-sm">{footer}</div>}
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
