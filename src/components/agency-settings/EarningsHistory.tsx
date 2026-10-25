import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InfoHint } from '@/components/common/InfoHint';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { usePagedEarningsList } from '@/hooks/useEarnings';
import { earningsService } from '@/services/earnings.service';
import { usePageRefresh } from '@/store/pageRefresh.store';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
  AgencyDamageClaim,
  EarningsAdjustment,
  EarningsAdjustmentKind,
  EarningsListMeta,
} from '@/types/earnings.types';
import { explainAdjustment, explainClaim } from './earningsExplanation';

/**
 * "Why was my money taken?" — the two lists that sit under the balance on the
 * Payout tab (2026-10-22, api-doc/agency/earnings.md):
 *
 * - **Adjustments**: every movement that took money back, paid a debt, or
 *   forgave one. ⚠ `takenFrom.debt > 0` is the line that matters most — the
 *   balances could not cover it, so the agency now owes that much.
 * - **Damage claims**: parcels charged to the agency inside its damage-claim
 *   window, capped by its own max refund per item, plus its investigation fee.
 */

const PAGE_LIMIT = 10;

/**
 * Sign and colour per kind. A clawback and a debt repayment both keep money
 * from reaching the agency; a write-off is Wi-Mall forgiving a debt.
 */
const KIND_VIEW = {
  refund_clawback: { sign: '−', className: 'text-red-600' },
  clawback_recovery: { sign: '−', className: 'text-muted-foreground' },
  write_off: { sign: '', className: 'text-green-600' },
} as const satisfies Record<EarningsAdjustmentKind, { sign: string; className: string }>;

const KIND_LABEL = {
  refund_clawback: 'earnings.adjustments.kind.refund_clawback',
  clawback_recovery: 'earnings.adjustments.kind.clawback_recovery',
  write_off: 'earnings.adjustments.kind.write_off',
} as const satisfies Record<EarningsAdjustmentKind, string>;

const isKnownKind = (kind: string): kind is EarningsAdjustmentKind => kind in KIND_VIEW;

/** Title, the description on desktop, and the same description behind an ⓘ on a phone. */
function ListHeader({ title, description, short, aboutLabel }: {
  title: string;
  description: string;
  short: string;
  aboutLabel: string;
}) {
  return (
    <CardHeader className="space-y-1 max-md:px-0">
      <CardTitle className="flex items-center gap-2">
        {title}
        <InfoHint className="md:hidden" label={aboutLabel}>{description}</InfoHint>
      </CardTitle>
      <CardDescription className="max-md:hidden">{description}</CardDescription>
      <CardDescription className="md:hidden">{short}</CardDescription>
    </CardHeader>
  );
}

/** Loading / error / empty, or the rows and the pager. */
function ListBody({ isLoading, loadError, isEmpty, loadingText, emptyText, onRetry, meta, onPage, children }: {
  isLoading: boolean;
  loadError: string | null;
  isEmpty: boolean;
  loadingText: string;
  emptyText: string;
  onRetry: () => void;
  meta: EarningsListMeta | null;
  onPage: (page: number) => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation('common');
  if (isLoading && isEmpty) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {loadingText}
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="py-6 text-center">
        <p className="mb-4 text-sm text-muted-foreground">{loadError}</p>
        <Button variant="outline" onClick={onRetry}>{t('actions.retry')}</Button>
      </div>
    );
  }
  if (isEmpty) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{emptyText}</p>
    );
  }
  const pages = meta?.pages || 1;
  return (
    <>
      <ul className={cn('divide-y rounded-lg border', isLoading && 'opacity-60')}>{children}</ul>
      {meta && pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t('pagination.pageOf', { page: meta.page, total: pages })}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || meta.page <= 1}
              onClick={() => onPage(meta.page - 1)}
            >
              {t('actions.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || meta.page >= pages}
              onClick={() => onPage(meta.page + 1)}
            >
              {t('actions.next')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export function EarningsAdjustmentsCard() {
  const { t, i18n } = useTranslation('account');
  const { rows, meta, setPage, isLoading, loadError, refetch } = usePagedEarningsList(
    earningsService.listAdjustments,
    PAGE_LIMIT,
  );
  usePageRefresh(refetch, isLoading);

  return (
    <Card className={sectionSurfaceClass}>
      <ListHeader
        title={t('earnings.adjustments.title')}
        description={t('earnings.adjustments.description')}
        short={t('earnings.adjustments.short')}
        aboutLabel={t('earnings.adjustments.aboutLabel')}
      />
      <CardContent className="space-y-4 max-md:px-0">
        <ListBody
          isLoading={isLoading}
          loadError={loadError}
          isEmpty={rows.length === 0}
          loadingText={t('earnings.adjustments.loading')}
          emptyText={t('earnings.adjustments.empty')}
          onRetry={refetch}
          meta={meta}
          onPage={setPage}
        >
          {rows.map((row) => (
            <AdjustmentRow key={row.id} row={row} explanation={explainAdjustment(t, i18n.resolvedLanguage, row)} />
          ))}
        </ListBody>
      </CardContent>
    </Card>
  );
}

function AdjustmentRow({ row, explanation }: { row: EarningsAdjustment; explanation: string }) {
  const { t } = useTranslation('account');
  // ⛔ An unknown kind gets a neutral label and no sign — never a guessed direction.
  const kind = row.kind;
  const view = isKnownKind(kind) ? KIND_VIEW[kind] : { sign: '', className: '' };
  const label = isKnownKind(kind) ? t(KIND_LABEL[kind]) : t('earnings.adjustments.kind.unknown');
  const debt = row.takenFrom?.debt ?? 0;

  return (
    <li className="space-y-1.5 p-3 md:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Badge variant="outline" className="text-xs">{label}</Badge>
          <span className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</span>
        </div>
        <span className={cn('whitespace-nowrap font-medium', view.className)}>
          {view.sign}{formatCurrency(row.amount, row.currency)}
        </span>
      </div>
      <p className="text-sm">{explanation}</p>
      {debt > 0 && (
        <p className="text-xs text-orange-600">
          <span className="font-medium">
            {t('earnings.adjustments.owed', { amount: formatCurrency(debt, row.currency) })}
          </span>
          {' · '}
          {t('earnings.adjustments.owedNote')}
        </p>
      )}
    </li>
  );
}

export function DamageClaimsCard() {
  const { t, i18n } = useTranslation('account');
  const { rows, meta, setPage, isLoading, loadError, refetch } = usePagedEarningsList(
    earningsService.listClaims,
    PAGE_LIMIT,
  );
  usePageRefresh(refetch, isLoading);

  return (
    <Card className={sectionSurfaceClass}>
      <ListHeader
        title={t('earnings.claims.title')}
        description={t('earnings.claims.description')}
        short={t('earnings.claims.short')}
        aboutLabel={t('earnings.claims.aboutLabel')}
      />
      <CardContent className="space-y-4 max-md:px-0">
        <ListBody
          isLoading={isLoading}
          loadError={loadError}
          isEmpty={rows.length === 0}
          loadingText={t('earnings.claims.loading')}
          emptyText={t('earnings.claims.empty')}
          onRetry={refetch}
          meta={meta}
          onPage={setPage}
        >
          {rows.map((claim) => (
            <ClaimRow key={claim.id} claim={claim} explanation={explainClaim(t, i18n.resolvedLanguage, claim)} />
          ))}
        </ListBody>
      </CardContent>
    </Card>
  );
}

function ClaimRow({ claim, explanation }: { claim: AgencyDamageClaim; explanation: string }) {
  const { t } = useTranslation('account');
  const unknown = t('earnings.claims.unknownRef');
  const money = (n: number) => formatCurrency(n, claim.currency);

  return (
    <li className="space-y-1.5 p-3 md:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {t('earnings.claims.order', { order: claim.orderNumber ?? unknown })}
            <span className="text-muted-foreground">
              {' · '}{t('earnings.claims.parcel', { parcel: claim.trackingNumber ?? unknown })}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">{formatDate(claim.createdAt)}</p>
        </div>
        {/* `amount` excludes the investigation fee, so the total is their sum. */}
        <div className="text-end">
          <p className="whitespace-nowrap font-medium text-red-600">
            −{money(claim.amount + claim.investigationFee)}
          </p>
          <p className="whitespace-nowrap text-xs text-muted-foreground">
            {claim.investigationFee > 0
              ? t('earnings.claims.withFee', { amount: money(claim.amount), fee: money(claim.investigationFee) })
              : t('earnings.claims.charged', { amount: money(claim.amount) })}
          </p>
        </div>
      </div>
      <p className="text-sm">{explanation}</p>
    </li>
  );
}
