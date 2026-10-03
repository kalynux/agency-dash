import type { ComponentType, ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Briefcase, CalendarClock, MapPin, Wallet, Banknote } from 'lucide-react';
import { InfoHint } from '@/components/common/InfoHint';
import { formatCurrency, formatDate } from '@/lib/format';
import { tokenLabel } from '@/components/agents/tokenLabel';
import {
  cadenceLabel,
  employmentTypeLabel,
  feeModelLabel,
  regionLabel,
} from '@/components/agents/contractTerms';
import type { AgentMembership } from '@/types/agent.types';

/**
 * Every term of a contract, read-only and in plain words.
 *
 * The membership dialog used to show its terms only as the editor — a page of
 * inputs, half of them empty selects, with the figures that matter (what the
 * agent earns, when cash is handed over, where they may work) buried in input
 * boxes, and the lifecycle stamps not shown at all. This is the answer to "what
 * did we agree?"; the editor below it is the answer to "change it".
 *
 * Only the amount matching `feeSplit.model` is read — a stale share can sit
 * beside `monthly_salary` after a model switch.
 */

/** One label/value line. */
function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
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
    <section className="rounded-xl border bg-card px-4 pb-1 pt-3">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
        {hint && <InfoHint title={title}>{hint}</InfoHint>}
      </h3>
      <dl className="mt-1 divide-y">{children}</dl>
    </section>
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
}: {
  membership: AgentMembership;
  country: string | null | undefined;
}) {
  const { t, i18n } = useTranslation('agents');
  const { feeSplit, remittanceTerms, coverage, employment, shipmentValueCeiling } = membership;
  const currency = feeSplit.currency || 'XAF';
  const notSet = <Muted>{t('terms.values.notSet')}</Muted>;

  const earns = (() => {
    switch (feeSplit.model) {
      case 'percentage':
        return feeSplit.agentSharePercent == null
          ? notSet
          : t('membership.overview.shareAmount', { percent: feeSplit.agentSharePercent });
      case 'flat':
        return feeSplit.agentFlatFee == null
          ? notSet
          : t('membership.overview.flatAmount', { amount: formatCurrency(feeSplit.agentFlatFee, currency) });
      case 'monthly_salary':
        return feeSplit.agentMonthlySalary == null
          ? notSet
          : t('membership.overview.salaryAmount', {
              amount: formatCurrency(feeSplit.agentMonthlySalary, currency),
            });
      default:
        return notSet;
    }
  })();

  const cadence = remittanceTerms.cadence;
  const handoverDay =
    (cadence === 'weekly' || cadence === 'biweekly') && remittanceTerms.dayOfWeek != null
      ? weekdayName(remittanceTerms.dayOfWeek, i18n.language)
      : cadence === 'monthly' && remittanceTerms.dayOfMonth != null
        ? t('membership.overview.dayOfMonth', { day: remittanceTerms.dayOfMonth })
        : null;
  const showHandoverDay = cadence === 'weekly' || cadence === 'biweekly' || cadence === 'monthly';

  // Lifecycle stamps in the order they happen; only the ones that did.
  const stamps: { key: string; label: string; at: string | null }[] = [
    { key: 'created', label: t('membership.overview.createdAt'), at: membership.createdAt },
    { key: 'invited', label: t('membership.overview.invitedAt'), at: membership.invitedAt },
    { key: 'requested', label: t('membership.overview.requestedAt'), at: membership.requestedAt },
    { key: 'approved', label: t('membership.overview.approvedAt'), at: membership.approvedAt },
    { key: 'suspended', label: t('membership.overview.suspendedAt'), at: membership.suspendedAt },
    { key: 'updated', label: t('membership.overview.updatedAt'), at: membership.updatedAt },
  ].filter((s) => s.at);

  return (
    <div className="space-y-3">
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
        <Row label={t('membership.overview.agentEarns')}>{earns}</Row>
        <Row label={t('terms.fields.currency')}>{currency}</Row>
      </Group>

      <Group icon={Banknote} title={t('terms.fields.remittance')} hint={t('terms.fields.remittanceHint')}>
        <Row label={t('membership.overview.howOften')}>{cadence ? cadenceLabel(cadence) : notSet}</Row>
        {showHandoverDay && (
          <Row label={t('membership.overview.handoverDay')}>{handoverDay ?? notSet}</Row>
        )}
        <Row label={t('membership.overview.grace')}>
          {t('membership.overview.graceValue', { hours: remittanceTerms.graceHours ?? 0 })}
        </Row>
      </Group>

      <Group icon={MapPin} title={t('terms.fields.coverage')} hint={t('terms.fields.regionsHint')}>
        <Row label={t('terms.fields.regions')}>
          {coverage.regions.length === 0 ? (
            <Muted>{t('terms.values.allRegions')}</Muted>
          ) : (
            <span className="flex flex-wrap justify-end gap-1">
              {coverage.regions.map((r) => (
                <span key={r} className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">
                  {regionLabel(r, country)}
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

      <Group icon={CalendarClock} title={t('membership.overview.contract')}>
        <Row label={t('membership.overview.origin')}>{tokenLabel('agents:origin', membership.origin)}</Row>
        <Row label={t('membership.overview.termsVersion')}>
          {membership.termsVersion > 0 ? (
            t('membership.overview.termsVersionValue', { version: membership.termsVersion })
          ) : (
            <Muted>{t('membership.overview.termsNeverStated')}</Muted>
          )}
        </Row>
        {stamps.map((s) => (
          <Row key={s.key} label={s.label}>
            {formatDate(s.at)}
          </Row>
        ))}
        {membership.status === 'suspended' && membership.suspensionReason && (
          <Row label={t('membership.overview.suspensionReason')}>
            {t('membership.ending.quotedReason', { reason: membership.suspensionReason })}
          </Row>
        )}
      </Group>
    </div>
  );
}
