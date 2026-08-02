import type { ReactNode } from 'react';
import { MapPin, Package, Shield, ShieldCheck, Star, Timer, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatVehicleType } from '@/components/agents/vehicle.constants';
import { VehicleIcon } from '@/components/agents/VehicleIcon';
import type { AgentDirectoryItem, AgentRating } from '@/types/agent.types';

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-medium text-right">{value}</span>
    </div>
  );
}

function RatingRow({ label, rating }: { label: string; rating: AgentRating }) {
  return (
    <StatRow
      label={label}
      value={
        rating.average == null ? (
          <span className="text-muted-foreground">Not rated yet</span>
        ) : (
          <span className="flex items-center justify-end gap-1">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            {rating.average.toFixed(1)}
            <span className="text-muted-foreground font-normal">({rating.count})</span>
          </span>
        )
      }
    />
  );
}

const AVAILABILITY_LABEL: Record<string, string> = {
  online: 'Online — wants work',
  on_break: 'On a break',
  offline: 'Offline',
};

const WORKING_STATE_LABEL: Record<string, string> = {
  idle: 'Free right now',
  working: 'On a job',
  at_capacity: 'At capacity',
};

export interface AgentDetailSheetProps {
  agent: AgentDirectoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Primary action(s) in the sticky footer (e.g. the contract-request button). */
  footerSlot?: ReactNode;
}

/**
 * The agent's public work profile. Contact details are deliberately absent —
 * they are earned by contracting and arrive with the roster, never the directory.
 */
export function AgentDetailSheet({ agent, open, onOpenChange, footerSlot }: AgentDetailSheetProps) {
  if (!agent) return null;

  const availability = String(agent.availability);
  const workingState = String(agent.workingState);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] flex flex-col rounded-t-2xl px-0 pb-0">
        <div className="mx-auto w-10 h-1 bg-muted rounded-full mt-2 mb-1 flex-shrink-0" />

        <SheetHeader className="px-5 pb-2 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden border border-border">
              {agent.avatar?.url ? (
                <img src={agent.avatar.url} crossOrigin="use-credentials" alt={agent.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-7 h-7 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <SheetTitle className="text-base leading-tight">{agent.name}</SheetTitle>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {agent.kycVerified ? (
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
                <Badge variant="secondary" className="gap-1 text-xs font-medium">
                  <VehicleIcon vehicleType={agent.vehicleType} className="w-3 h-3" />
                  {agent.vehicleType ? formatVehicleType(agent.vehicleType) : 'No vehicle'}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <Separator className="flex-shrink-0" />

        <ScrollArea className="flex-1 overflow-hidden">
          <div className="px-5 py-4 space-y-5">
            {agent.homeBase.label && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Home base
                </h3>
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {agent.homeBase.label}
                  </p>
                  {agent.homeBase.serviceRadiusKm != null && (
                    <p className="text-xs text-muted-foreground">
                      Works within {agent.homeBase.serviceRadiusKm} km of here
                    </p>
                  )}
                </div>
              </section>
            )}

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Track record
              </h3>
              <div className="rounded-lg border divide-y">
                <StatRow
                  label="Trust score"
                  value={
                    <span className="flex items-center justify-end gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      {agent.trustScore} / 100
                    </span>
                  }
                />
                <StatRow
                  label="Deliveries completed"
                  value={
                    <span className="flex items-center justify-end gap-1">
                      <Package className="w-3 h-3" />
                      {agent.completedShipments.toLocaleString()}
                    </span>
                  }
                />
                <StatRow
                  label="On time"
                  value={
                    agent.onTimeRate == null ? (
                      <span className="text-muted-foreground">Not enough deliveries yet</span>
                    ) : (
                      <span className="flex items-center justify-end gap-1">
                        <Timer className="w-3 h-3" />
                        {Math.round(agent.onTimeRate * 100)}%
                      </span>
                    )
                  }
                />
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Ratings
              </h3>
              <div className="rounded-lg border divide-y">
                <RatingRow label="From customers" rating={agent.ratings.customer} />
                <RatingRow label="From agencies" rating={agent.ratings.agency} />
                <RatingRow label="From vendors" rating={agent.ratings.vendor} />
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Right now
              </h3>
              <div className="rounded-lg border divide-y">
                <StatRow label="Availability" value={AVAILABILITY_LABEL[availability] ?? availability} />
                <StatRow label="Workload" value={WORKING_STATE_LABEL[workingState] ?? workingState} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Phone, email and live position aren't shown here — those come with the contract, not
                the directory.
              </p>
            </section>
          </div>
        </ScrollArea>

        {footerSlot && <div className="px-5 py-4 border-t flex-shrink-0">{footerSlot}</div>}
      </SheetContent>
    </Sheet>
  );
}
