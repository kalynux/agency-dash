import type { ComponentType, ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Banknote, Briefcase, CalendarClock, FileText, HandCoins, MapPin, Wallet } from 'lucide-react';
import { InfoHint } from '@/components/common/InfoHint';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { tokenLabel } from '@/components/agents/tokenLabel';
import {
  cadenceLabel,
  employmentTypeLabel,
  feeModelLabel,
  regionLabel,
} from '@/components/agents/contractTerms';
import { HISTORY_MEMBERSHIP_STATUSES, type AgentMembership } from '@/types/agent.types';

/**
 * Every term of a contract, read-only and in plain words.
 *
 * Two layers: four key figures up top — what the agent earns, when cash comes
 * back, how much COD they may carry, where they work — which answer most
 * visits on their own; then every term grouped the way the agency thinks about
 * it, ending with a timeline of the contract's life. The COD limit and the
 * cash held are part of the deal, so they sit here with the hand-over terms
 * rather than in a card of their own.
 *
 * Only the amount matching `feeSplit.model` is read — a stale share can sit
 * beside `monthly_salary` after a model switch.
 */

/** One label/value line. */
function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-end text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

/** A titled block of rows. */
function Group({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card px-4 pb-1.5 pt-3.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        {title}
        {hint && <InfoHint title={title}>{hint}</InfoHint>}
      </h3>
      <dl className="mt-1.5 divide-y">{children}</dl>
    </section>
  );
}

/** One of the headline figures. */
function KeyFigure({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border bg-card p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1.5 break-words text-sm font-semibold leading-snug">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="font-normal text-muted-foreground">{children}</span>;
}

function weekdayName(day: number, locale: string): string {
  // 2024-01-07 is a Sunday, and the API counts 0 = Sunday.
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(2024, 0, 7 + day));
}

export function ContractOverview({
  membership,
  country,
  agentName,
  agentVerified,
  cashHeld,
}: {
  membership: AgentMembership;
  country: string | null | undefined;
  agentName: string;
  /** Strict `false` only — an absent flag is no claim either way. */
  agentVerified: boolean | undefined;
  /** COD cash the agent holds for this contract. */
  cashHeld: number;
}) {
  const { t, i18n } = useTranslation(['agents', 'common']);
  const { feeSplit, remittanceTerms, coverage, employment, shipmentValueCeiling } = membership;
  const currency = feeSplit.currency || 'XAF';
  const notSet = <Muted>{t('terms.values.notSet')}</Muted>;
  const editable = !HISTORY_MEMBERSHIP_STATUSES.includes(membership.status);

  const earns = (() => {
    switch (feeSplit.model) {
      case 'percentage':
        return feeSplit.agentSharePercent == null
          ? null
          : t('membership.overview.shareAmount', { percent: feeSplit.agentSharePercent });
      case 'flat':
        return feeSplit.agentFlatFee == null
          ? null
          : t('membership.overview.flatAmount', { amount: formatCurrency(feeSplit.agentFlatFee, currency) });
      case 'monthly_salary':
        return feeSplit.agentMonthlySalary == null
          ? null
          : t('membership.overview.salaryAmount', {
              amount: formatCurrency(feeSplit.agentMonthlySalary, currency),
            });
      default:
        return null;
    }
  })();

  const cadence = remittanceTerms.cadence;
  const showHandoverDay = cadence === 'weekly' || cadence === 'biweekly' || cadence === 'monthly';
  const handoverDay =
    (cadence === 'weekly' || cadence === 'biweekly') && remittanceTerms.dayOfWeek != null
      ? weekdayName(remittanceTerms.dayOfWeek, i18n.language)
      : cadence === 'monthly' && remittanceTerms.dayOfMonth != null
        ? t('membership.overview.dayOfMonth', { day: remittanceTerms.dayOfMonth })
        : null;

  const regions = coverage.regions.map((r) => regionLabel(r, country));
  const worksIn =
    regions.length === 0
      ? t('terms.values.allRegions')
      : regions.length === 1
        ? regions[0]
        : `${regions[0]} +${regions.length - 1}`;

  const hasCod = membership.codThreshold > 0;
  const codDormant = hasCod && agentVerified === false;

  // The contract's life in the order it happened; only what did. `updatedAt`
  // is not an event, so it is a row of the Contract group instead.
  const stamps = (
    [
      { key: 'created', label: t('membership.overview.createdAt'), at: membership.createdAt },
      { key: 'invited', label: t('membership.overview.invitedAt'), at: membership.invitedAt },
      { key: 'requested', label: t('membership.overview.requestedAt'), at: membership.requestedAt },
      { key: 'approved', label: t('membership.overview.approvedAt'), at: membership.approvedAt },
      {
        key: 'suspended',
        label: t('membership.overview.suspendedAt'),
        at: membership.suspendedAt,
        note:
          membership.status === 'suspended' && membership.suspensionReason
            ? t('membership.ending.quotedReason', { reason: membership.suspensionReason })
            : null,
      },
      { key: 'rejected', label: t('membership.overview.rejectedAt'), at: membership.rejectedAt },
      { key: 'withdrawn', label: t('membership.overview.withdrawnAt'), at: membership.withdrawnAt },
      { key: 'removed', label: t('membership.overview.removedAt'), at: membership.removedAt },
    ] as { key: string; label: string; at: string | null; note?: string | null }[]
  )
    .filter((s): s is { key: string; label: string; at: string; note?: string | null } => !!s.at)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="space-y-3">
      {/* The answer to "what did we agree?" in four figures. */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <KeyFigure
          icon={Wallet}
          label={t('membership.overview.agentEarns')}
          value={earns ?? notSet}
          sub={feeSplit.model ? feeModelLabel(String(feeSplit.model)) : undefined}
        />
        <KeyFigure
          icon={Banknote}
          label={t('membership.overview.handover')}
          value={cadence ? cadenceLabel(cadence) : notSet}
          sub={showHandoverDay ? handoverDay ?? undefined : undefined}
        />
        <KeyFigure
          icon={HandCoins}
          label={t('membership.cod.cap')}
          value={hasCod ? formatNumber(membership.codThreshold) : <Muted>{t('membership.cod.noCod')}</Muted>}
          sub={
            codDormant ? (
              <span className="text-amber-600 dark:text-amber-400">{t('membership.cod.dormantUnverified')}</span>
            ) : (
              `${t('membership.cod.held')}: ${formatNumber(cashHeld)}`
            )
          }
        />
        <KeyFigure icon={MapPin} label={t('membership.overview.worksIn')} value={worksIn} />
      </div>

      <Group
        icon={Wallet}
        title={t('membership.overview.pay')}
        hint={
          <Trans
            ns="agents"
            i18nKey={feeSplit.model === 'monthly_salary' ? 'terms.fields.salaryHint' : 'terms.fields.feeSplitHint'}
            components={{ strong: <span className="font-medium text-foreground" /> }}
          />
        }
      >
        <Row label={t('terms.fields.model')}>{feeSplit.model ? feeModelLabel(String(feeSplit.model)) : notSet}</Row>
        <Row label={t('membership.overview.agentEarns')}>{earns ?? notSet}</Row>
        <Row label={t('terms.fields.currency')}>{currency}</Row>
      </Group>

      <Group icon={HandCoins} title={t('membership.overview.cash')} hint={t('terms.fields.remittanceHint')}>
        <Row
          label={
            <>
              {t('membership.cod.cap')}
              <InfoHint title={t('membership.cod.cap')}>{t('membership.cod.hint')}</InfoHint>
            </>
          }
        >
          {hasCod ? <span className="tabular-nums">{formatNumber(membership.codThreshold)}</span> : <Muted>{t('membership.cod.noCod')}</Muted>}
        </Row>
        <Row label={t('membership.cod.held')}>
          <span className="tabular-nums">{formatNumber(cashHeld)}</span>
        </Row>
        <Row label={t('membership.overview.howOften')}>{cadence ? cadenceLabel(cadence) : notSet}</Row>
        {showHandoverDay && <Row label={t('membership.overview.handoverDay')}>{handoverDay ?? notSet}</Row>}
        <Row label={t('membership.overview.grace')}>
          {t('membership.overview.graceValue', { hours: remittanceTerms.graceHours ?? 0 })}
        </Row>
        {/* Since 2026-09-27 a limit on an unverified agent is accepted but
            DORMANT: every COD shipment to them is refused until verification.
            And `0` is not "uncapped": it grants no COD at all — the assignment
            list drops such an agent from COD runs without saying why, so this
            is the one place that can. */}
        {(codDormant || (editable && !hasCod)) && (
          <p className="mb-2 mt-1 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            {codDormant ? t('membership.cod.dormantUnverified') : t('membership.cod.zeroWarning')}
          </p>
        )}
      </Group>

      <Group icon={MapPin} title={t('terms.fields.coverage')} hint={t('terms.fields.regionsHint')}>
        <Row label={t('terms.fields.regions')}>
          {regions.length === 0 ? (
            <Muted>{t('terms.values.allRegions')}</Muted>
          ) : (
            <span className="flex flex-wrap justify-end gap-1">
              {regions.map((label, i) => (
                <span key={coverage.regions[i]} className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">
                  {label}
                </span>
              ))}
            </span>
          )}
        </Row>
        {coverage.area && <Row label={t('terms.paths.coverage.area')}>{t('terms.values.mapArea')}</Row>}
        <Row label={t('terms.fields.ceiling')}>
          {shipmentValueCeiling == null ? (
            <Muted>{t('terms.values.noCap')}</Muted>
          ) : (
            formatCurrency(shipmentValueCeiling, currency)
          )}
        </Row>
      </Group>

      <Group icon={Briefcase} title={t('terms.fields.employment')} hint={t('terms.fields.employmentHint')}>
        <Row label={t('terms.fields.employmentType')}>
          {employment.employmentType ? employmentTypeLabel(employment.employmentType) : notSet}
        </Row>
        <Row label={t('terms.fields.employmentRef')}>
          {employment.employeeRef ? <span className="font-mono">{employment.employeeRef}</span> : notSet}
        </Row>
        <Row label={t('terms.fields.employmentStarted')}>
          {employment.startedAt ? formatDate(employment.startedAt) : notSet}
        </Row>
        <Row label={t('terms.fields.employmentEnds')}>
          {employment.endsAt ? formatDate(employment.endsAt) : <Muted>{t('membership.overview.openEnded')}</Muted>}
        </Row>
      </Group>

      <Group icon={FileText} title={t('membership.overview.contract')}>
        <Row label={t('membership.overview.origin')}>{tokenLabel('agents:origin', membership.origin)}</Row>
        <Row label={t('membership.overview.primaryAgency')}>
          {membership.isPrimary ? t('common:values.yes') : <Muted>{t('common:values.no')}</Muted>}
        </Row>
        {membership.status === 'pending' && membership.termsProposedBy && (
          <Row label={t('membership.overview.proposedBy')}>
            {membership.termsProposedBy === 'agency' ? t('membership.overview.you') : agentName}
          </Row>
        )}
        <Row label={t('membership.overview.termsVersion')}>
          {membership.termsVersion > 0 ? (
            t('membership.overview.termsVersionValue', { version: membership.termsVersion })
          ) : (
            <Muted>{t('membership.overview.termsNeverStated')}</Muted>
          )}
        </Row>
        <Row label={t('membership.overview.updatedAt')}>{formatDate(membership.updatedAt)}</Row>
      </Group>

      {stamps.length > 0 && (
        <Group icon={CalendarClock} title={t('membership.overview.timeline')}>
          <ol className="relative my-2 ms-2.5 space-y-4 border-s ps-5">
            {stamps.map((s, i) => (
              <li key={s.key} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    'absolute -start-[1.6rem] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-card',
                    i === stamps.length - 1 ? 'bg-primary' : 'bg-muted-foreground/40',
                  )}
                />
                <p className="text-sm font-medium leading-tight">{s.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(s.at)}</p>
                {s.note && <p className="mt-1 text-xs">{s.note}</p>}
              </li>
            ))}
          </ol>
        </Group>
      )}
    </div>
  );
}
