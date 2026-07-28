import { Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CardPreviewProps {
  /** Card network, e.g. `visa`, `mastercard`. Rendered in the corner. */
  brand?: string | null;
  /** Last 4 digits — shown in the masked card number when no full number is given. */
  last4?: string | null;
  holderName?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
  className?: string;
}

function maskedNumber(last4?: string | null): string {
  const groups = ['••••', '••••', '••••', last4 && last4.length === 4 ? last4 : '••••'];
  return groups.join(' ');
}

function formatExpiry(month?: number | null, year?: number | null): string {
  if (!month && !year) return 'MM/YY';
  const mm = month ? String(month).padStart(2, '0') : 'MM';
  const yy = year ? String(year).slice(-2) : 'YY';
  return `${mm}/${yy}`;
}

/**
 * The blue gradient card visual from the checkout mockup. Used in the card-entry
 * path of checkout and to display a selected/saved card.
 */
export function CardPreview({
  brand,
  last4,
  holderName,
  expMonth,
  expYear,
  className,
}: CardPreviewProps) {
  return (
    <div
      className={cn(
        'relative aspect-[1.6/1] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-5 text-white shadow-lg',
        className,
      )}
    >
      {/* Decorative sheen */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-12 -left-6 h-40 w-40 rounded-full bg-white/5" />

      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-white/70">Card type</span>
        <span className="text-lg font-bold uppercase italic tracking-tight">
          {brand ?? 'CARD'}
        </span>
      </div>

      <Wifi className="mt-5 h-6 w-6 rotate-90 text-white/80" />

      <div className="mt-3 font-mono text-lg tracking-widest sm:text-xl">
        {maskedNumber(last4)}
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {holderName?.trim() || 'Card holder'}
          </span>
        </div>
        <div className="text-right">
          <span className="block text-[10px] uppercase tracking-wide text-white/60">Valid</span>
          <span className="text-sm font-medium">{formatExpiry(expMonth, expYear)}</span>
        </div>
      </div>
    </div>
  );
}
