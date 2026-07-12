import type { ReactNode } from 'react';
import { Info, RotateCcw, ShieldCheck, Store, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { VendorBrowseItemDto } from '@/types/vendor-connection.types';

export interface VendorCardProps {
  vendor: VendorBrowseItemDto;
  onInfo?: () => void;
  /** Custom content (e.g. connection-status action buttons) rendered at the right of the card. */
  rightSlot?: ReactNode;
}

/** Presentational vendor card — logo, name, KYC badge, address, policy chips. */
export function VendorCard({ vendor, onInfo, rightSlot }: VendorCardProps) {
  const addr = vendor.primaryAddress;
  const p = vendor.policies;

  return (
    <div className="rounded-xl border-2 border-border bg-card overflow-hidden transition-all duration-200">
      <div className="flex items-stretch">
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
              {vendor.logoUrl ? (
                <img src={vendor.logoUrl} alt={vendor.businessName} className="w-full h-full object-cover" />
              ) : (
                <Store className="w-5 h-5 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-semibold text-sm truncate">{vendor.displayName ?? vendor.businessName}</p>
                {vendor.kycVerified && (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" aria-label="KYC Verified" />
                )}
              </div>

              {addr && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {addr.city}
                  {addr.state ? `, ${addr.state}` : ''}
                </p>
              )}

              {p && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.returnPolicy && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-muted',
                        p.returnPolicy.returnEligible ? 'text-emerald-600' : 'text-muted-foreground',
                      )}
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      {p.returnPolicy.returnEligible ? 'Returns accepted' : 'No returns'}
                    </span>
                  )}
                  {p.cancellationPolicy && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-muted',
                        p.cancellationPolicy.cancellable ? 'text-emerald-600' : 'text-muted-foreground',
                      )}
                    >
                      <XCircle className="w-2.5 h-2.5" />
                      {p.cancellationPolicy.cancellable ? 'Cancellable' : 'Not cancellable'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {rightSlot && (
          <div className="flex items-center justify-center gap-1.5 px-3 flex-shrink-0 border-l border-border/60">
            {rightSlot}
          </div>
        )}

        {onInfo && (
          <button
            type="button"
            onClick={onInfo}
            aria-label={`View details for ${vendor.businessName}`}
            className="flex items-center justify-center w-12 flex-shrink-0 border-l border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function VendorCardSkeleton() {
  return (
    <div className="rounded-xl border p-4 flex items-center gap-3">
      <Skeleton className="w-11 h-11 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
