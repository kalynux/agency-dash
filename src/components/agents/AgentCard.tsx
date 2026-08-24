import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, MapPin, ShieldCheck, Star, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatVehicleType } from '@/components/agents/vehicle.constants';
import { VehicleIcon } from '@/components/agents/VehicleIcon';
import { txStatic } from '@/i18n/tx';
import type { AgentDirectoryItem } from '@/types/agent.types';

/**
 * Does the agent want work right now — their own switch, not their load.
 * Colour only; the labels live in `agents:availability.*` /
 * `agents:workingState.*`, and both fall back to the raw token because the
 * backend types these as strings rather than a closed enum.
 */
const AVAILABILITY_STYLE: Record<string, string> = {
  online: 'text-emerald-600',
  on_break: 'text-amber-600',
  offline: 'text-muted-foreground',
};

function labelFor(group: 'availability' | 'workingState', token: string): string {
  const key = `agents:${group}.${token}`;
  const translated = txStatic(key);
  return translated === key ? token : translated;
}

export interface AgentCardProps {
  agent: AgentDirectoryItem;
  onInfo?: () => void;
  /** Custom content (e.g. contract-state action buttons) rendered at the right of the card. */
  rightSlot?: ReactNode;
}

/** Presentational directory card — avatar, name, KYC badge, home base, vehicle/trust chips. */
export function AgentCard({ agent, onInfo, rightSlot }: AgentCardProps) {
  const { t } = useTranslation('agents');
  const availability = String(agent.availability);
  const workingState = String(agent.workingState);

  return (
    <div className="rounded-xl border-2 border-border bg-card overflow-hidden transition-all duration-200">
      {/* Same restack as `VendorCard`: below `md` the content claims the first
          line on its own and the actions fall onto a bar beneath it. */}
      <div className="flex items-stretch max-md:flex-wrap max-md:justify-end">
        <div className="flex-1 p-4 min-w-0 max-md:basis-full">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
              {agent.avatar?.url ? (
                <img src={agent.avatar.url} alt={agent.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* `min-w-0` so `truncate` actually fires inside a flex row — see VendorCard. */}
                <p className="font-semibold text-sm truncate min-w-0">{agent.name}</p>
                {agent.kycVerified && (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" aria-label={t('card.kycVerified')} />
                )}
              </div>

              {agent.homeBase.label && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {agent.homeBase.label}
                  {agent.homeBase.serviceRadiusKm != null &&
                    ` · ${t('card.serviceRadius', { km: agent.homeBase.serviceRadiusKm })}`}
                </p>
              )}

              <div className="flex flex-wrap gap-1 mt-2">
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  <VehicleIcon vehicleType={agent.vehicleType} className="w-2.5 h-2.5" />
                  {agent.vehicleType ? formatVehicleType(agent.vehicleType) : t('vehicle.none')}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                  {t('card.trust', { score: agent.trustScore })}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-muted',
                    AVAILABILITY_STYLE[availability] ?? 'text-muted-foreground',
                  )}
                >
                  {workingState === 'idle'
                    ? labelFor('availability', availability)
                    : t('card.availabilityWithState', {
                        availability: labelFor('availability', availability),
                        state: labelFor('workingState', workingState),
                      })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {rightSlot && (
          <div className="flex items-center justify-center gap-1.5 px-3 flex-shrink-0 border-s border-border/60 max-md:flex-1 max-md:justify-end max-md:border-s-0 max-md:border-t max-md:py-2.5">
            {rightSlot}
          </div>
        )}

        {onInfo && (
          <button
            type="button"
            onClick={onInfo}
            aria-label={t('card.viewDetails', { name: agent.name })}
            className="flex items-center justify-center w-12 flex-shrink-0 border-s border-border/60 max-md:border-t text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function AgentCardSkeleton() {
  return (
    <div className="rounded-xl border p-4 flex items-center gap-3">
      <Skeleton className="w-11 h-11 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
