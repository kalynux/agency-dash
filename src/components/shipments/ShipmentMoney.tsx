/**
 * The two numbers that decide how a shipment gets dispatched: the cash the agent
 * has to take at the door, and what the run pays the agency once the agent's cut
 * comes out of the delivery fee.
 *
 * Both now ride on the shipment *list* as well as the detail, so they are shown
 * where the decision is actually made — scanning the queue, and again in the
 * sheet next to the agent picker. Everything money-shaped is in this one file so
 * the "this is an estimate" caveat is worded once: the contract's `fee_split` is
 * re-read when the money is really split, so it can move before delivery.
 *
 * See api-doc/agency/shipments.md#money.
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Banknote, CreditCard, Wallet } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { tx } from '@/i18n/tx';
import { cn } from '@/lib/utils';
import type {
  AgencyEarning,
  ShipmentCodInfo,
  ShipmentDetail,
  ShipmentListItem,
} from '@/types/shipment.types';

/** `true` while no agent has accepted — `expectedAmount` is then a projection, not a snapshot. */
function isProjected(cod: ShipmentCodInfo): boolean {
  return cod.status === null;
}

/**
 * `deliveryFee → agentCut → codHandlingFee → amount`, as a two-column list.
 * Shared by the list tooltip and the detail card so the arithmetic is only
 * spelled out once. Zero parts are dropped: an agent cut of 0 is legitimate
 * (no contract — you keep the whole fee) and printing "−0" only adds noise.
 */
function EarningBreakdown({ earning, className }: { earning: AgencyEarning; className?: string }) {
  const { t } = useTranslation('shipments');
  const money = (value: number) => formatCurrency(value, earning.currency);

  return (
    <div className={cn('grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs', className)}>
      <span>{t('money.deliveryFee')}</span>
      <span className="font-numeric text-end">{money(earning.earnedFee)}</span>

      {earning.agentCut > 0 && (
        <>
          <span>{t('money.agentCut')}</span>
          <span className="font-numeric text-end">−{money(earning.agentCut)}</span>
        </>
      )}

      {earning.codHandlingFee > 0 && (
        <>
          <span>{t('money.codHandlingFee')}</span>
          <span className="font-numeric text-end">+{money(earning.codHandlingFee)}</span>
        </>
      )}

      {/* `bg-current` + opacity rather than a `border` token: this list also
          renders inside a tooltip, whose background is the *foreground* colour
          in both themes — a fixed border colour would vanish in one of them. */}
      <div className="col-span-2 h-px bg-current opacity-20" aria-hidden />

      <span className="font-medium">{t('money.youKeep')}</span>
      <span className="text-end font-numeric font-semibold">{money(earning.amount)}</span>
    </div>
  );
}

// ─── List row ─────────────────────────────────────────────────────────────────

export interface ShipmentMoneyCellProps {
  shipment: ShipmentListItem;
  className?: string;
}

/**
 * Compact cash + payout for a list row. Renders nothing at all when the payload
 * carries none of the money fields (a shipment from before the backend sent
 * them) — an empty cell beats a column of dashes that reads as "pays nothing".
 */
export function ShipmentMoneyCell({ shipment, className }: ShipmentMoneyCellProps) {
  const { t } = useTranslation(['shipments', 'common']);
  const { cod, agencyEarning, agencyEarningUnavailable, paymentMethod } = shipment;

  if (!paymentMethod && !cod && !agencyEarning && !agencyEarningUnavailable) return null;

  // Both gap axes are set here so a caller can flip this to a row with nothing
  // but `flex-row` — a lone `gap-x-*` override would race the stylesheet's own
  // ordering against `gap`.
  return (
    <div className={cn('flex flex-col items-start gap-x-3 gap-y-1', className)}>
      {cod ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-help items-center gap-1.5 rounded-md bg-gold-500/15 px-2 py-0.5 text-gold-700 dark:text-gold-400">
              <Banknote className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="font-numeric text-xs font-semibold">
                {formatCurrency(cod.expectedAmount, cod.currency)}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-[16rem] space-y-1">
            <p className="font-medium">{t('money.cashToCollect')}</p>
            <p>{isProjected(cod) ? t('money.codProjectedHint') : t('money.codSnapshotHint')}</p>
          </TooltipContent>
        </Tooltip>
      ) : paymentMethod === 'online' ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CreditCard className="h-3.5 w-3.5 flex-shrink-0" />
          {t('money.prepaid')}
        </span>
      ) : null}

      {agencyEarning ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-help items-center gap-1.5 text-xs text-success">
              <Wallet className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="font-numeric font-semibold">
                {t('money.approx', {
                  amount: formatCurrency(agencyEarning.amount, agencyEarning.currency),
                })}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-[16rem] space-y-1.5">
            <p className="font-medium">{t('money.youEarnTitle')}</p>
            <EarningBreakdown earning={agencyEarning} />
            <p className="opacity-75">{t('money.estimateCaveat')}</p>
          </TooltipContent>
        </Tooltip>
      ) : agencyEarningUnavailable ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-help items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5 flex-shrink-0" />
              {tx(t, `shipments:money.unavailableShort.${agencyEarningUnavailable}`)}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-[16rem]">
            {tx(t, `shipments:money.unavailable.${agencyEarningUnavailable}`)}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

/** Amount + caption tile, the shared frame of the two money cards below. */
function MoneyTile({
  icon: Icon,
  label,
  amount,
  /** The "amount" is a word, not a figure ("Prepaid") — no mono, no display size. */
  amountIsText,
  caption,
  tone,
  children,
}: {
  icon: React.ElementType;
  label: string;
  amount?: string;
  amountIsText?: boolean;
  caption?: string;
  tone: 'gold' | 'success' | 'muted';
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        tone === 'gold' && 'border-gold-400/50 bg-gold-50/70 dark:border-gold-500/25 dark:bg-gold-500/10',
        tone === 'success' && 'border-success/30 bg-success/5',
        tone === 'muted' && 'border-dashed',
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon
          className={cn(
            'h-3.5 w-3.5 flex-shrink-0',
            tone === 'gold' && 'text-gold-700 dark:text-gold-400',
            tone === 'success' && 'text-success',
            tone === 'muted' && 'text-muted-foreground',
          )}
        />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      {amount && (
        <p
          className={cn(
            'mt-1 font-bold tracking-tight',
            amountIsText ? 'text-sm' : 'font-numeric text-lg',
            tone === 'gold' && 'text-gold-700 dark:text-gold-400',
            tone === 'success' && 'text-success',
          )}
        >
          {amount}
        </p>
      )}
      {caption && <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>}
      {children}
    </div>
  );
}

/**
 * The money region of the detail sheet: cash at the door on the left, the
 * agency's net payout on the right, and the parent order's value underneath as
 * context. Deliberately sits just above the agent picker — choosing who to send
 * is exactly the moment both figures matter.
 */
export function ShipmentMoneySection({ detail }: { detail: ShipmentDetail }) {
  const { t } = useTranslation(['shipments', 'common', 'cash']);
  const { cod, agencyEarning, agencyEarningUnavailable, orderValue } = detail;

  // "Prepaid" is only stated when the payload actually says so — a `cod` that is
  // absent because the backend predates these fields must not be read as
  // "nothing to collect", which is the one wrong answer here.
  const showPrepaid = !cod && detail.paymentMethod === 'online';
  const showEarning = !!agencyEarning || !!agencyEarningUnavailable;

  if (!cod && !showPrepaid && !showEarning && !orderValue) return null;

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('detail.money')}
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cod && (
          <MoneyTile
            icon={Banknote}
            tone="gold"
            label={t('money.cashToCollect')}
            amount={formatCurrency(cod.expectedAmount, cod.currency)}
            caption={
              isProjected(cod)
                ? t('money.codProjectedCaption')
                : [
                    tx(t, `cash:collectionStatus.${cod.status}`),
                    cod.collectedAt ? formatDateTime(cod.collectedAt) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
            }
          />
        )}

        {showPrepaid && (
          <MoneyTile
            icon={CreditCard}
            tone="muted"
            label={t('money.payment')}
            amount={t('money.prepaid')}
            amountIsText
            caption={t('money.prepaidCaption')}
          />
        )}

        {agencyEarning ? (
          <MoneyTile
            icon={Wallet}
            tone="success"
            label={t('money.youEarnTitle')}
            amount={t('money.approx', {
              amount: formatCurrency(agencyEarning.amount, agencyEarning.currency),
            })}
          >
            <EarningBreakdown earning={agencyEarning} className="mt-2 text-muted-foreground" />
          </MoneyTile>
        ) : agencyEarningUnavailable ? (
          <MoneyTile
            icon={Wallet}
            tone="muted"
            label={t('money.youEarnTitle')}
            amount={t('common:values.notAvailable')}
            amountIsText
            caption={tx(t, `shipments:money.unavailable.${agencyEarningUnavailable}`)}
          >
            {agencyEarningUnavailable === 'no_agency_policy' && (
              <Link
                to="/dashboard/settings/policies"
                className="mt-1.5 inline-block text-xs font-medium text-primary hover:underline"
              >
                {t('money.setPricing')}
              </Link>
            )}
          </MoneyTile>
        ) : null}
      </div>

      {agencyEarning && (
        <p className="mt-2 text-xs text-muted-foreground">{t('money.estimateCaveat')}</p>
      )}

      {/* The whole order, which can split across several shipments and several
          agencies — so it is deliberately *not* presented next to the COD figure
          as if they were the same money. */}
      {orderValue && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t('money.orderValue', {
            amount: formatCurrency(orderValue.total, orderValue.currency),
          })}
        </p>
      )}
    </section>
  );
}
