import type { ReactNode } from 'react';
import {
  CalendarClock, Globe, Headphones, RotateCcw, Shield, ShieldCheck, Store, XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { VendorBrowseItemDto } from '@/types/vendor-connection.types';

function PolicyRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-medium text-right">{value}</span>
    </div>
  );
}

const AVAILABILITY_LABEL: Record<string, string> = {
  '24_7': '24/7',
  business_hours: 'Business hours',
  limited: 'Limited',
};

export interface VendorDetailSheetProps {
  vendor: VendorBrowseItemDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Primary action(s) rendered in the sheet's sticky footer (e.g. a connection-request button). */
  footerSlot?: ReactNode;
}

export function VendorDetailSheet({ vendor, open, onOpenChange, footerSlot }: VendorDetailSheetProps) {
  if (!vendor) return null;

  const addr = vendor.primaryAddress;
  const p = vendor.policies;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] flex flex-col rounded-t-2xl px-0 pb-0">
        <div className="mx-auto w-10 h-1 bg-muted rounded-full mt-2 mb-1 flex-shrink-0" />

        <SheetHeader className="px-5 pb-2 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden border border-border">
              {vendor.logoUrl ? (
                <img src={vendor.logoUrl} alt={vendor.businessName} crossOrigin="use-credentials" className="w-full h-full object-cover" />
              ) : (
                <Store className="w-7 h-7 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <SheetTitle className="text-base leading-tight">{vendor.displayName ?? vendor.businessName}</SheetTitle>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {vendor.kycVerified ? (
                  <Badge variant="secondary" className="gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800">
                    <ShieldCheck className="w-3 h-3" />
                    KYC Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 text-xs font-medium text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800">
                    <Shield className="w-3 h-3" />
                    Unverified
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <Separator className="flex-shrink-0" />

        <ScrollArea className="flex-1 overflow-hidden">
          <div className="px-5 py-4 space-y-5">
            {addr && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Address
                </h3>
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <p className="text-sm font-medium">{addr.city}{addr.state ? `, ${addr.state}` : ''}</p>
                  <p className="text-xs text-muted-foreground">{addr.addressLine1}</p>
                </div>
              </section>
            )}

            {p?.returnPolicy && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Return Policy
                </h3>
                <div className="rounded-lg border divide-y">
                  <PolicyRow
                    label="Accepted"
                    value={
                      <span className="flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" />
                        {p.returnPolicy.returnEligible ? 'Yes' : 'No'}
                      </span>
                    }
                  />
                  {p.returnPolicy.returnEligible && (
                    <>
                      <PolicyRow label="Return window" value={`${p.returnPolicy.returnWindowDays} days after delivery`} />
                      <PolicyRow label="Refund type" value={<span className="capitalize">{p.returnPolicy.refundType}</span>} />
                    </>
                  )}
                </div>
              </section>
            )}

            {p?.cancellationPolicy && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Cancellation Policy
                </h3>
                <div className="rounded-lg border divide-y">
                  <PolicyRow
                    label="Cancellable"
                    value={
                      <span className="flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        {p.cancellationPolicy.cancellable ? 'Yes' : 'No'}
                      </span>
                    }
                  />
                  {p.cancellationPolicy.cancellable && p.cancellationPolicy.cancellationDeadline && (
                    <PolicyRow
                      label="Deadline"
                      value={
                        <span className="flex items-center gap-1">
                          <CalendarClock className="w-3 h-3" />
                          {p.cancellationPolicy.cancellationDeadline.replace(/_/g, ' ')}
                        </span>
                      }
                    />
                  )}
                </div>
              </section>
            )}

            {p?.supportPolicy && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Support
                </h3>
                <div className="rounded-lg border divide-y">
                  <PolicyRow
                    label="Availability"
                    value={
                      <span className="flex items-center gap-1">
                        <Headphones className="w-3 h-3" />
                        {p.supportPolicy.availability ? AVAILABILITY_LABEL[p.supportPolicy.availability] ?? p.supportPolicy.availability : '—'}
                      </span>
                    }
                  />
                  {p.supportPolicy.languages.length > 0 && (
                    <PolicyRow
                      label="Languages"
                      value={
                        <span className="flex items-center gap-1 uppercase">
                          <Globe className="w-3 h-3" />
                          {p.supportPolicy.languages.join(', ')}
                        </span>
                      }
                    />
                  )}
                </div>
              </section>
            )}
          </div>
        </ScrollArea>

        {footerSlot && (
          <div className="px-5 py-4 border-t flex-shrink-0">
            {footerSlot}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
