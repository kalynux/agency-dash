import { Component, type ErrorInfo, type ReactNode } from 'react';
import { withTranslation, type WithTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Catches the one failure route-level code splitting introduces: a page's chunk
 * cannot be fetched.
 *
 * It has exactly one cause in practice, and it is not a bug in the page. The web
 * dashboard is deployed as content-hashed files; a deploy that lands while
 * somebody has the app open leaves their `index.html` naming chunks that no
 * longer exist, so the next route change 404s. Before splitting, that session
 * simply kept running the old bundle — now it needs to be told.
 *
 * ⚠ **The recovery is a reload, not a retry.** `React.lazy` memoises the
 * rejected import promise, so re-rendering the same lazy component re-throws the
 * same rejection forever. Only a fresh document re-reads `index.html` and picks
 * up the new hashes. That is why this offers one button and it says "reload".
 *
 * On a packaged build the chunks are on the device and this cannot fire — a
 * failure there would mean a damaged install, for which a restart is also the
 * only honest advice.
 */

interface Props extends WithTranslation {
  children: ReactNode;
  /** Full-height, for the boundary that has no app chrome painted behind it. */
  fullScreen?: boolean;
}

interface State {
  hasError: boolean;
}

class RouteErrorBoundaryBase extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RouteErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { t, fullScreen } = this.props;
    return (
      <div
        role="alert"
        className={cn(
          'flex flex-col items-center justify-center gap-4 px-6 text-center',
          fullScreen ? 'min-h-screen' : 'py-24',
        )}
      >
        <p className="text-base font-semibold">{t('states.routeFailedTitle')}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t('states.routeFailedBody')}
        </p>
        <Button onClick={() => window.location.reload()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t('actions.reload')}
        </Button>
      </div>
    );
  }
}

export const RouteErrorBoundary = withTranslation('common')(RouteErrorBoundaryBase);
