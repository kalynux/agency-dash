import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/lib/format';
import {
  Activity,
  Building2,
  Lock,
  MapPin,
  Package,
  Shield,
  ShieldCheck,
  Star,
  Store,
  Timer,
  User,
  Users,
} from 'lucide-react';
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ResponsiveSheetShell } from '@/components/common/ResponsiveSheetShell';
import { formatVehicleType } from '@/components/agents/vehicle.constants';
import { VehicleIcon } from '@/components/agents/VehicleIcon';
import { txStatic } from '@/i18n/tx';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import type { AgentDirectoryItem, AgentRating } from '@/types/agent.types';

// ─── Building blocks ──────────────────────────────────────────────────────────

/** A pill that wraps instead of running off a 360px screen (`Badge` is nowrap). */
function Chip({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium leading-snug',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** One of the three headline numbers. */
function StatTile({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: ComponentType<{ className?: string }>;
  tone: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center rounded-2xl border bg-card px-2 py-3.5 text-center shadow-sm">
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-full', tone)}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-2 text-lg font-semibold leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 text-[11px] leading-tight text-muted-foreground">{label}</p>
      {sub && <p className="mt-1 text-[10px] leading-tight text-muted-foreground/80">{sub}</p>}
    </div>
  );
}

/** A titled card of rows. */
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">{children}</div>
    </section>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 text-sm">{label}</span>
      <span className="min-w-0 text-end text-sm font-medium">{value}</span>
    </div>
  );
}

function RatingValue({ rating }: { rating: AgentRating }) {
  const { t } = useTranslation('agents');
  if (rating.average == null) {
    return <span className="font-normal text-muted-foreground">{t('detail.notRated')}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
      {rating.average.toFixed(1)}
      <span className="font-normal text-muted-foreground">{t('detail.ratingCount', { count: rating.count })}</span>
    </span>
  );
}

/** A status with its colour dot. */
function StatusValue({ dot, children }: { dot: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} />
      {children}
    </span>
  );
}

/**
 * The long-form availability/workload copy this sheet uses — wordier than the
 * chips on the card, which read from `agents:availability.*`. Both are open
 * unions on the wire, so an unrecognised token falls back to itself.
 */
function longLabel(group: 'availabilityLong' | 'workingStateLong', token: string): string {
  const key = `agents:detail.${group}.${token}`;
  const translated = txStatic(key);
  return translated === key ? token : translated;
}

const AVAILABILITY_DOT: Record<string, string> = {
  online: 'bg-emerald-500',
  on_break: 'bg-amber-500',
  offline: 'bg-muted-foreground/40',
};

const WORKLOAD_DOT: Record<string, string> = {
  idle: 'bg-emerald-500',
  working: 'bg-sky-500',
  at_capacity: 'bg-amber-500',
};

// ─── Sheet ────────────────────────────────────────────────────────────────────

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
 *
 * Laid out like a profile, not a form: who they are up top, the three numbers
 * an agency decides on as tiles, the rest as icon-led rows, and the one action
 * full width at the thumb.
 */
export function AgentDetailSheet({ agent, open, onOpenChange, footerSlot }: AgentDetailSheetProps) {
  const { t } = useTranslation('agents');
  if (!agent) return null;

  const availability = String(agent.availability);
  const workingState = String(agent.workingState);

  return (
    // Bottom sheet on a phone, centred popup on desktop — a 90dvh sheet rising
    // across a whole monitor read as the page being replaced.
    <ResponsiveSheetShell
      open={open}
      onOpenChange={onOpenChange}
      mobileClassName="h-[90dvh] rounded-t-3xl border-t-0"
    >
        {/* Native scrolling, not Radix ScrollArea — that one never scrolls on a
            touch screen (see AgentMembershipDialog). The hero scrolls with the
            content so the stats get the whole screen once you start reading. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <SheetHeader className="relative items-center gap-0 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent px-5 pb-5 pt-3 text-center md:pt-8">
            <div className="mb-5 h-1 w-10 rounded-full bg-muted-foreground/25 md:hidden" />

            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-muted shadow-md">
                {agent.avatar?.url ? (
                  <img src={agent.avatar.url} alt={agent.name} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-9 w-9 text-muted-foreground" />
                )}
              </div>
              <span
                aria-hidden
                className={cn(
                  'absolute bottom-1 end-1 h-4 w-4 rounded-full border-[3px] border-background',
                  AVAILABILITY_DOT[availability] ?? AVAILABILITY_DOT.offline,
                )}
              />
            </div>

            <SheetTitle className="mt-3 flex max-w-full items-center justify-center gap-1 text-xl font-semibold">
              <span className="truncate">{agent.name}</span>
              <VerifiedBadge verified={agent.kycVerified} />
            </SheetTitle>
            <SheetDescription className="sr-only">{t('detail.privacyNote')}</SheetDescription>

            {agent.homeBase.label && (
              <p className="mt-1 flex max-w-full items-center justify-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{agent.homeBase.label}</span>
              </p>
            )}

            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {agent.kycVerified ? (
                <Chip className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  {t('detail.kycVerified')}
                </Chip>
              ) : (
                <Chip className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                  {/* Verification gates COD only — say what it costs, not "blocked". */}
                  {t('detail.notVerifiedCod')}
                </Chip>
              )}
              <Chip className="bg-card">
                <VehicleIcon vehicleType={agent.vehicleType} className="h-3.5 w-3.5 shrink-0" />
                {agent.vehicleType ? formatVehicleType(agent.vehicleType) : t('vehicle.none')}
              </Chip>
            </div>
          </SheetHeader>

          <div className="space-y-6 px-4 pb-6">
            {/* The three numbers an agency decides on. */}
            <section className="space-y-2">
              <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('detail.trackRecord')}
              </h3>
              <div className="grid grid-cols-3 gap-2.5">
                <StatTile
                  icon={Star}
                  tone="bg-yellow-400/15 text-yellow-600 dark:text-yellow-400"
                  label={t('detail.trustScore')}
                  value={t('detail.trustOutOf', { score: agent.trustScore })}
                />
                <StatTile
                  icon={Package}
                  tone="bg-primary/10 text-primary"
                  label={t('detail.deliveriesCompleted')}
                  value={formatNumber(agent.completedShipments)}
                />
                <StatTile
                  icon={Timer}
                  tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  label={t('detail.onTime')}
                  value={
                    agent.onTimeRate == null
                      ? '—'
                      : t('detail.onTimeRate', { percent: Math.round(agent.onTimeRate * 100) })
                  }
                  sub={agent.onTimeRate == null ? t('detail.notEnoughDeliveries') : undefined}
                />
              </div>
              {agent.homeBase.label && agent.homeBase.serviceRadiusKm != null && (
                <p className="flex items-center gap-1.5 px-1 pt-1 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {t('detail.serviceRadius', { km: agent.homeBase.serviceRadiusKm })}
                </p>
              )}
            </section>

            <Card title={t('detail.ratings')}>
              <Row icon={Users} label={t('detail.fromCustomers')} value={<RatingValue rating={agent.ratings.customer} />} />
              <Row icon={Building2} label={t('detail.fromAgencies')} value={<RatingValue rating={agent.ratings.agency} />} />
              <Row icon={Store} label={t('detail.fromVendors')} value={<RatingValue rating={agent.ratings.vendor} />} />
            </Card>

            <Card title={t('detail.rightNow')}>
              <Row
                icon={Activity}
                label={t('detail.availability')}
                value={
                  <StatusValue dot={AVAILABILITY_DOT[availability] ?? AVAILABILITY_DOT.offline}>
                    {longLabel('availabilityLong', availability)}
                  </StatusValue>
                }
              />
              <Row
                icon={Package}
                label={t('detail.workload')}
                value={
                  <StatusValue dot={WORKLOAD_DOT[workingState] ?? 'bg-muted-foreground/40'}>
                    {longLabel('workingStateLong', workingState)}
                  </StatusValue>
                }
              />
            </Card>

            <div className="flex gap-3 rounded-2xl bg-muted/60 p-4">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-relaxed text-muted-foreground">{t('detail.privacyNote')}</p>
            </div>
          </div>
        </div>

        {footerSlot && (
          <div className="flex flex-shrink-0 justify-center border-t bg-background/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur [&>a]:w-full [&>button]:w-full">
            {footerSlot}
          </div>
        )}
    </ResponsiveSheetShell>
  );
}
