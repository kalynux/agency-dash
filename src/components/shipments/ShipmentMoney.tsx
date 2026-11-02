/**
 * The two numbers that decide how a shipment gets dispatched: the cash the agent
 * has to take at the door, and what the run pays the agency once the agent's cut
 * comes out of the delivery fee.
 *
 * Both now ride on the shipment *list* as well as the detail, so they are shown
 * where the decision is actually made — scanning the queue, and again in the
 * sheet next to the agent picker. Everything money-shaped is in this one file so
 * the "this is an estimate" caveat is worded once: the contract's `fee_split` is
 * re-read when the money is really split, so it can move before delivery. Once
 * the delivery is paid out (`estimated: false`) the figure is final and says so.
 *
 * See api-doc/agency/shipments.md#money.
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Banknote, CreditCard, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { tx } from '@/i18n/tx';
import { cn } from '@/lib/utils';
import { prepaidAmountOf } from '@/components/shipments/shipment-actions';
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

/** An online order whose customer hands the agent only the delivery fee in cash. */
function isDeliveryFeeOnly(cod: ShipmentCodInfo): boolean {
  return cod.kind === 'delivery_fee';
}

/**
 * "Goods X + delivery Y" — only when the server sent both halves and the cash
 * really is mixed. Both figures are the server's, and nothing is added up here:
 * `expectedAmount` is already their sum, less anything prepaid online.
 */
function useCashSplit(cod: ShipmentCodInfo): string | null {
  const { t } = useTranslation('shipments');
  if (isDeliveryFeeOnly(cod)) return null;
  if (typeof cod.itemsAmount !== 'number' || typeof cod.deliveryFeeAmount !== 'number') return null;
  if (cod.deliveryFeeAmount <= 0) return null;
  return t('money.cashSplit', {
    items: formatCurrency(cod.itemsAmount, cod.currency),
    delivery: formatCurrency(cod.deliveryFeeAmount, cod.currency),
  });
}

/**
 * "6,000 already paid online, collect 14,000" on a parcel partly paid online.
 * Display only: the prepaid part is not cash, so it never joins a cash total.
 * Once the cash is collected or the collection cancelled there is nothing left
 * to collect, so only the online part is stated.
 */
function usePrepaidLine(cod: ShipmentCodInfo): string | null {
  const { t } = useTranslation('shipments');
  const prepaid = prepaidAmountOf(cod);
  if (prepaid <= 0) return null;
  if (cod.status === 'collected' || cod.status === 'cancelled') {
    return t('money.prepaidShort', { amount: formatCurrency(prepaid, cod.currency) });
  }
  return t('money.prepaidPartial', {
    prepaid: formatCurrency(prepaid, cod.currency),
    cash: formatCurrency(cod.expectedAmount, cod.currency),
  });
}

/** The cash pill's tooltip body — what the money is, then where the figure comes from. */
function CodTooltipBody({ cod }: { cod: ShipmentCodInfo }) {
  const { t } = useTranslation('shipments');
  const split = useCashSplit(cod);
  const prepaidLine = usePrepaidLine(cod);
  return (
    <>
      <p className="font-medium">{isDeliveryFeeOnly(cod) ? t('money.deliveryFeeOnly') : t('money.cashToCollect')}</p>
      {isDeliveryFeeOnly(cod) && <p>{t('money.deliveryFeeOnlyHint')}</p>}
      {split && <p className="font-numeric">{split}</p>}
      {prepaidLine && <p className="font-numeric">{prepaidLine}</p>}
      <p>
        {isProjected(cod)
          ? prepaidLine
            ? t('money.codProjectedPrepaidHint')
            : t('money.codProjectedHint')
          : t('money.codSnapshotHint')}
      </p>
    </>
  );
}

/**
 * `true` once the delivery has been paid out and the figures are the real
 * entries. Only an explicit `false` counts: a payload that omits the flag is
 * still an estimate, which is the safe reading for money not yet credited.
 */
function isFinal(earning: AgencyEarning): boolean {
  return earning.estimated === false;
}

/**
 * The headline amount — exact once final, "≈" while it is still an estimate.
 * Shared by the list cell and the detail tile so the two never disagree.
 */
function useEarningCopy(earning: AgencyEarning, shipment: Pick<ShipmentListItem, 'status' | 'paymentMethod' | 'cod'>) {
  const { t } = useTranslation('shipments');
  const final = isFinal(earning);
  const money = formatCurrency(earning.amount, earning.currency);
  // A returned COD run earns nothing: no cash was collected, so no entry is
  // written — and the same for a delivery fee due in cash. The server already
  // sends 0; this only says why.
  const paidInCash = shipment.paymentMethod === 'cash_on_delivery' || shipment.cod?.kind === 'delivery_fee';
  const returnedCod = shipment.status === 'returned' && paidInCash && earning.amount === 0;
  // Except a parcel partly paid online: its return fee can come out of that
  // prepaid part or from the vendor, once an administrator settles who was at fault.
  const returnedPrepaid = returnedCod && prepaidAmountOf(shipment.cod) > 0;
  return {
    final,
    title: final ? t('money.youEarnedTitle') : t('money.youEarnTitle'),
    amount: final ? money : t('money.approx', { amount: money }),
    allocation: final && earning.allocationStatus
      ? tx(t, `shipments:money.allocation.${earning.allocationStatus}`)
      : null,
    caveat: returnedPrepaid
      ? t('money.returnedPrepaid')
      : returnedCod
        ? t('money.returnedCodZero')
        : final
          ? t('money.finalCaveat')
          : t('money.estimateCaveat'),
  };
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

      {earning.agentCut > 0 ? (
        <>
          <span>{t('money.agentCut')}</span>
          <span className="font-numeric text-end">−{money(earning.agentCut)}</span>
        </>
      ) : (
        // A salaried agent's cut is 0 by design — they are paid outside
        // Wi-Mall — so say so rather than drop the line as if unconfigured.
        earning.basis === 'contract_salary' && (
          <>
            <span>{t('money.agentCut')}</span>
            <span className="text-end">{t('money.agentSalaried')}</span>
          </>
        )
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

/** The payout half of a list row: "≈ amount" while estimated, the exact figure once paid. */
function EarningCell({ earning, shipment }: { earning: AgencyEarning; shipment: ShipmentListItem }) {
  const copy = useEarningCopy(earning, shipment);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help items-center gap-1.5 text-xs text-success">
          <Wallet className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="font-numeric font-semibold">{copy.amount}</span>
          {copy.final && <BadgeCheck className="h-3 w-3 flex-shrink-0" aria-label={copy.title} />}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[16rem] space-y-1.5">
        <p className="font-medium">
          {copy.title}
          {copy.allocation && <span className="font-normal opacity-75"> · {copy.allocation}</span>}
        </p>
        <EarningBreakdown earning={earning} />
        <p className="opacity-75">{copy.caveat}</p>
      </TooltipContent>
    </Tooltip>
  );
}

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
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
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
              <CodTooltipBody cod={cod} />
            </TooltipContent>
          </Tooltip>
          {prepaidAmountOf(cod) > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CreditCard className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="font-numeric">
                {t('money.prepaidShort', { amount: formatCurrency(prepaidAmountOf(cod), cod.currency) })}
              </span>
            </span>
          )}
        </span>
      ) : paymentMethod === 'online' ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CreditCard className="h-3.5 w-3.5 flex-shrink-0" />
          {t('money.prepaid')}
        </span>
      ) : null}

      {agencyEarning ? (
        <EarningCell earning={agencyEarning} shipment={shipment} />
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

/** The payout tile: title and amount switch from estimate to final once the delivery is paid. */
function EarningTile({ earning, detail }: { earning: AgencyEarning; detail: ShipmentDetail }) {
  const copy = useEarningCopy(earning, detail);
  return (
    <MoneyTile
      icon={Wallet}
      tone="success"
      label={copy.title}
      amount={copy.amount}
      caption={copy.allocation ?? undefined}
    >
      <EarningBreakdown earning={earning} className="mt-2 text-muted-foreground" />
      <p className="mt-2 text-xs text-muted-foreground">{copy.caveat}</p>
    </MoneyTile>
  );
}

/**
 * What the agent collects at the door. A delivery fee paid in cash on an online
 * order is badged as such — it is not order cash, and no COD handling fee is
 * taken from it — mixed cash shows its two halves, and a parcel partly paid
 * online says how much of that is already covered.
 */
function CodTile({ cod }: { cod: ShipmentCodInfo }) {
  const { t } = useTranslation(['shipments', 'cash']);
  const split = useCashSplit(cod);
  const prepaidLine = usePrepaidLine(cod);
  return (
    <MoneyTile
      icon={Banknote}
      tone="gold"
      label={t('money.cashToCollect')}
      amount={formatCurrency(cod.expectedAmount, cod.currency)}
      caption={
        isProjected(cod)
          ? t('money.codProjectedCaption')
          : [tx(t, `cash:collectionStatus.${cod.status}`), cod.collectedAt ? formatDateTime(cod.collectedAt) : null]
              .filter(Boolean)
              .join(' · ')
      }
    >
      {isDeliveryFeeOnly(cod) && (
        <>
          <Badge
            variant="outline"
            className="mt-2 border-gold-400/60 font-normal text-gold-700 dark:border-gold-500/40 dark:text-gold-400"
          >
            {t('money.deliveryFeeOnly')}
          </Badge>
          <p className="mt-1.5 text-xs text-muted-foreground">{t('money.deliveryFeeOnlyHint')}</p>
        </>
      )}
      {split && <p className="mt-1.5 font-numeric text-xs text-muted-foreground">{split}</p>}
      {prepaidLine && (
        <p className="mt-1.5 font-numeric text-xs font-medium text-foreground">{prepaidLine}</p>
      )}
    </MoneyTile>
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
        {cod && <CodTile cod={cod} />}

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
          <EarningTile earning={agencyEarning} detail={detail} />
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
