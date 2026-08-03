import type { ReactNode, ElementType } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Inbox } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import { getApiErrorMessage, getRequestId } from '@/lib/errors';
import { cn } from '@/lib/utils';

/**
 * Shared loading / error / empty states so every data surface looks and
 * behaves the same. Compose them directly, or use {@link AsyncBoundary}.
 */

// ─── Loading ────────────────────────────────────────────────────────────────

export function LoadingState({
  label,
  className,
}: {
  /** Defaults to the generic "Loading…" from the `common` bundle. */
  label?: string;
  className?: string;
}) {
  const { t } = useTranslation(['common', 'errors']);
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Spinner className="size-6" />
      <p className="text-sm">{label ?? t('states.loading')}</p>
    </div>
  );
}

/** A skeleton stand-in for a list/table while the first page loads. */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

// ─── Error ──────────────────────────────────────────────────────────────────

export function ErrorState({
  error,
  onRetry,
  title,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  const { t } = useTranslation(['common', 'errors']);
  // Resolved here rather than in a default parameter so it re-renders on a
  // language switch, and so the backend code maps through the `errors` bundle.
  const message = getApiErrorMessage(error);
  const requestId = getRequestId(error);
  return (
    <Empty className={cn('border', className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10">
          <AlertCircle className="text-destructive" />
        </EmptyMedia>
        <EmptyTitle>{title ?? t('states.errorTitle')}</EmptyTitle>
        <EmptyDescription>
          {message}
          {requestId && (
            <>
              <br />
              <span className="text-xs opacity-70">
                {t('errors:requestId', { requestId })}
              </span>
            </>
          )}
        </EmptyDescription>
      </EmptyHeader>
      {onRetry && (
        <EmptyContent>
          <Button variant="outline" onClick={onRetry}>
            {t('actions.retry')}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

// ─── Empty ────────────────────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn('border', className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

// ─── Combined boundary ────────────────────────────────────────────────────────

/**
 * Standard branch order for a data surface: loading → error → empty → content.
 * Pass `isEmpty` explicitly so the caller decides what "empty" means.
 */
export function AsyncBoundary({
  isLoading,
  error,
  onRetry,
  isEmpty = false,
  loadingState,
  emptyState,
  children,
}: {
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  loadingState?: ReactNode;
  emptyState?: ReactNode;
  children: ReactNode;
}) {
  if (isLoading) return <>{loadingState ?? <LoadingState />}</>;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isEmpty) return <>{emptyState ?? <DefaultEmptyState />}</>;
  return <>{children}</>;
}

function DefaultEmptyState() {
  const { t } = useTranslation(['common', 'errors']);
  return <EmptyState title={t('states.emptyTitle')} />;
}
