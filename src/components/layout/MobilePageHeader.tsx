import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScrollDirection } from '@/hooks/use-scroll-direction';

interface MobilePageHeaderProps {
  title: string;
  /** When provided, a leading back button is shown. */
  onBack?: () => void;
  /** Right-aligned action icons/buttons. */
  actions?: ReactNode;
  /**
   * Search / filter row. Stays pinned under the title but collapses while the
   * user scrolls down and slides back in on scroll-up.
   */
  subheader?: ReactNode;
  className?: string;
}

/**
 * Shared mobile page header: a pinned title bar (title + optional back +
 * actions) with a reveal-on-scroll-up subheader. Intended to be rendered only
 * in the mobile branch of a page, inside a full-bleed (`-mx-6 -mt-6`) wrapper.
 */
export function MobilePageHeader({
  title,
  onBack,
  actions,
  subheader,
  className,
}: MobilePageHeaderProps) {
  const { t } = useTranslation('common');
  const direction = useScrollDirection();
  const subheaderHidden = direction === 'down';

  return (
    <div className={cn('sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b shadow-sm', className)}>
      {/* Pinned title bar */}
      <div className="flex h-14 items-center gap-1 px-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('actions.goBack')}
            className="-ms-2 flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" />
          </button>
        )}
        <h1 className="flex-1 truncate text-xl font-bold">{title}</h1>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>

      {subheader && (
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out',
            subheaderHidden ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
          )}
        >
          <div className="overflow-hidden">
            <div className="px-4 pb-3">{subheader}</div>
          </div>
        </div>
      )}
    </div>
  );
}
