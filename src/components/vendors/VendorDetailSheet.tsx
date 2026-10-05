import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Banknote, ExternalLink, FileText, Headphones, MapPin, RotateCcw, Shield, ShieldCheck, Store, XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ResponsiveSheetShell } from '@/components/common/ResponsiveSheetShell';
import { tx } from '@/i18n/tx';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { InfoHint } from '@/components/common/InfoHint';
import type {
  VendorBrowseItemDto,
  VendorCancellationPolicySummary,
} from '@/types/vendor-connection.types';

// ─── Layout primitives ────────────────────────────────────────────────────────

/** One label/value line. */
function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-end text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

/** A block of free text the vendor wrote — quoted, full width, never truncated. */
function Note({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-line rounded-lg bg-muted/50 px-3 py-2 text-sm leading-relaxed">
        {children}
      </dd>
    </div>
  );
}

/** A titled policy card. `status` is the yes/no headline shown on the title line. */
function PolicyCard({
  icon: Icon,
  title,
  status,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  status?: { ok: boolean; label: string };
  children?: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 px-4 py-3">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <h3 className="min-w-0 flex-1 text-sm font-semibold">{title}</h3>
        {status && (
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
              status.ok
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {status.label}
          </span>
        )}
      </div>
      {children && <dl className="divide-y border-t px-4">{children}</dl>}
    </section>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="font-normal text-muted-foreground">{children}</span>;
}

function Chips({ items }: { items: string[] }) {
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {items.map((item) => (
        <span key={item} className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">
          {item}
        </span>
      ))}
    </span>
  );
}

/** An ISO 639-1 code as its name in the reader's language ("fr" → "French"). */
function languageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

export interface VendorDetailSheetProps {
  vendor: VendorBrowseItemDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Primary action(s) rendered in the sheet's sticky footer (e.g. a connection-request button). */
  footerSlot?: ReactNode;
}

/**
 * A vendor's profile and every policy term an agency agrees to by connecting.
 *
 * Rewritten 2026-10-03: it showed three or four fields per policy (the browse
 * DTO carried no more) and scrolled through Radix `ScrollArea`, which never
 * scrolls on a touch screen — so on a phone the lower policies were simply out
 * of reach. Now it renders every field the backend sends, in plain words, and
 * scrolls natively. Fields an older backend omits drop their row rather than
 * showing a blank.
 */
export function VendorDetailSheet({ vendor, open, onOpenChange, footerSlot }: VendorDetailSheetProps) {
  const { t, i18n } = useTranslation(['vendors', 'common']);
  if (!vendor) return null;

  const addr = vendor.primaryAddress;
  const p = vendor.policies;
  const ret = p?.returnPolicy ?? null;
  const cancel = p?.cancellationPolicy ?? null;
  const support = p?.supportPolicy ?? null;
  const documents = p?.documents ?? [];
  const cod = vendor.codTerms ?? null;
  const yes = t('common:values.yes');
  const no = t('common:values.no');
  const notSet = <Muted>{t('detail.notSpecified')}</Muted>;
  const hasAnyPolicy = !!(ret || cancel || support || cod || documents.length > 0);

  const deadlineText = (c: VendorCancellationPolicySummary) => {
    if (!c.cancellationDeadline) return notSet;
    if (c.cancellationDeadline === 'anytime_until_days_before_delivery' && c.cancellationDeadlineDays != null) {
      return t('detail.deadlineDaysBefore', { count: c.cancellationDeadlineDays });
    }
    return tx(t, `vendors:detail.deadlines.${c.cancellationDeadline}`);
  };

  /** A fee or refund rule as one phrase. `kind` picks the wording for the zero/full cases. */
  const feeText = (type: string | null | undefined, value: number | null | undefined, kind: 'fee' | 'lateRefund') => {
    if (!type) return notSet;
    if (type === 'fixed') {
      return value == null
        ? notSet
        : tx(t, `vendors:detail.${kind}Values.fixed`, { amount: formatCurrency(value) });
    }
    if (type === 'percentage') {
      return value == null ? notSet : tx(t, `vendors:detail.${kind}Values.percentage`, { percent: value });
    }
    return tx(t, `vendors:detail.${kind}Values.${type}`);
  };

  return (
    // Bottom sheet on a phone, centred popup on desktop. An explicit height on
    // the sheet, not `max-h`: the native scroller below needs a definite flex
    // size to shrink into (see AgentMembershipDialog). The dialog sizes to its
    // content up to its own `max-h`, like `ResponsiveModal`.
    <ResponsiveSheetShell
      open={open}
      onOpenChange={onOpenChange}
      mobileClassName="h-[88dvh] rounded-t-2xl"
    >
        <div className="mx-auto mb-1 mt-2 h-1 w-10 flex-shrink-0 rounded-full bg-muted md:hidden" />

        <SheetHeader className="flex-shrink-0 px-5 pb-3 pe-12 md:pt-5">
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
              {vendor.logoUrl ? (
                <img src={vendor.logoUrl} alt={vendor.businessName} className="h-full w-full object-cover" />
              ) : (
                <Store className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1 pt-0.5 text-start">
              <SheetTitle className="text-base leading-tight">
                {vendor.displayName ?? vendor.businessName}
                <VerifiedBadge verified={vendor.kycVerified} className="ms-1" />
              </SheetTitle>
              <SheetDescription className="sr-only">{t('detail.policiesTitle')}</SheetDescription>
              {vendor.displayName && vendor.displayName !== vendor.businessName && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{vendor.businessName}</p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {vendor.kycVerified ? (
                  <Badge variant="secondary" className="gap-1 border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                    <ShieldCheck className="h-3 w-3" />
                    {t('detail.kycVerified')}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 border-amber-200 bg-amber-50 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
                    <Shield className="h-3 w-3" />
                    {t('detail.unverified')}
                  </Badge>
                )}
                {addr && (
                  <Badge variant="secondary" className="gap-1 text-xs font-medium">
                    <MapPin className="h-3 w-3" />
                    {addr.city}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <Separator className="flex-shrink-0" />

        {/* Native scrolling — Radix ScrollArea does not scroll on touch. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-4 px-5 py-4">
            {addr && (
              <section className="rounded-xl border bg-card px-4 py-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {addr.label || t('detail.address')}
                </p>
                <p className="mt-1 text-sm font-medium">
                  {addr.city}{addr.state ? `, ${addr.state}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">{addr.addressLine1}</p>
              </section>
            )}

            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold">{t('detail.policiesTitle')}</h2>
              <InfoHint title={t('detail.policiesTitle')}>{t('detail.policiesHint')}</InfoHint>
            </div>

            {!hasAnyPolicy && (
              <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                {t('detail.noPolicies')}
              </p>
            )}

            {ret && (
              <PolicyCard
                icon={RotateCcw}
                title={t('detail.returnPolicy')}
                status={{ ok: ret.returnEligible, label: ret.returnEligible ? t('detail.acceptsReturns') : t('detail.noReturns') }}
              >
                {ret.returnEligible ? (
                  <>
                    <Row label={t('detail.returnWindow')}>
                      {t('detail.returnWindowValue', { count: ret.returnWindowDays })}
                    </Row>
                    <Row label={t('detail.refundType')}>
                      {ret.refundType === 'partial' && ret.refundPercentage != null
                        ? t('detail.partialRefundValue', { percent: ret.refundPercentage })
                        : tx(t, `vendors:detail.refundTypes.${ret.refundType}`)}
                    </Row>
                    {ret.returnShippingPayer !== undefined && (
                      <Row label={t('detail.returnShipping')}>
                        {ret.returnShippingPayer
                          ? tx(t, `vendors:detail.shippingPayers.${ret.returnShippingPayer}`)
                          : notSet}
                      </Row>
                    )}
                    {ret.refundProcessingDays !== undefined && (
                      <Row label={t('detail.refundProcessing')}>
                        {ret.refundProcessingDays != null
                          ? t('detail.refundProcessingValue', { count: ret.refundProcessingDays })
                          : notSet}
                      </Row>
                    )}
                    {ret.inspector && (
                      <Row label={t('detail.inspector')}>
                        {tx(t, `vendors:detail.inspectors.${ret.inspector}`)}
                      </Row>
                    )}
                    {ret.returnConditionNotes && (
                      <Note label={t('detail.returnConditions')}>{ret.returnConditionNotes}</Note>
                    )}
                  </>
                ) : (
                  <Row label={t('detail.accepted')}>{no}</Row>
                )}
              </PolicyCard>
            )}

            {cancel && (
              <PolicyCard
                icon={XCircle}
                title={t('detail.cancellationPolicy')}
                status={{ ok: cancel.cancellable, label: cancel.cancellable ? t('detail.cancellable') : t('detail.notCancellable') }}
              >
                {cancel.cancellable ? (
                  <>
                    <Row label={t('detail.deadline')}>{deadlineText(cancel)}</Row>
                    {cancel.cancellationFeeType !== undefined && (
                      <Row label={t('detail.cancellationFee')}>
                        {feeText(cancel.cancellationFeeType, cancel.cancellationFeeValue, 'fee')}
                      </Row>
                    )}
                    {cancel.lateCancellationRefundType && (
                      <Row label={t('detail.lateRefund')}>
                        {feeText(cancel.lateCancellationRefundType, cancel.lateCancellationRefundValue, 'lateRefund')}
                      </Row>
                    )}
                  </>
                ) : (
                  <Row label={t('detail.cancellableLabel')}>{no}</Row>
                )}
              </PolicyCard>
            )}

            {cod && (
              <PolicyCard
                icon={Banknote}
                title={t('codTerms.title')}
                status={{ ok: cod.codEnabled, label: cod.codEnabled ? yes : no }}
              >
                <Row label={t('detail.codAccepted')}>
                  {cod.codEnabled ? t('codTerms.accepts') : t('codTerms.none')}
                </Row>
                {cod.codEnabled && (
                  <Row label={t('detail.codCap')}>
                    {typeof cod.maxCashPerAgency === 'number'
                      ? formatCurrency(cod.maxCashPerAgency)
                      : <Muted>{t('detail.noCodCap')}</Muted>}
                  </Row>
                )}
              </PolicyCard>
            )}

            {support && (
              <PolicyCard icon={Headphones} title={t('detail.support')}>
                <Row label={t('detail.availability')}>
                  {support.availability
                    ? tx(t, `vendors:detail.availabilities.${support.availability}`)
                    : notSet}
                </Row>
                {support.availabilityDescription && (
                  <Row label={t('detail.hours')}>{support.availabilityDescription}</Row>
                )}
                <Row label={t('detail.languages')}>
                  {support.languages.length > 0
                    ? <Chips items={support.languages.map((l) => languageName(l, i18n.language))} />
                    : notSet}
                </Row>
                {support.channelTypes && (
                  <Row label={t('detail.channels')}>
                    {support.channelTypes.length > 0
                      ? <Chips items={support.channelTypes.map((c) => tx(t, `vendors:detail.channelTypes.${c}`))} />
                      : notSet}
                  </Row>
                )}
                {support.requiredInfo && support.requiredInfo.length > 0 && (
                  <Row label={t('detail.requiredInfo')}>
                    <Chips items={support.requiredInfo.map((r) => tx(t, `vendors:detail.requiredInfos.${r}`))} />
                  </Row>
                )}
                {support.eligibilityNotes && (
                  <Note label={t('detail.supportNotes')}>{support.eligibilityNotes}</Note>
                )}
              </PolicyCard>
            )}

            {documents.length > 0 && (
              <PolicyCard icon={FileText} title={t('detail.documents')}>
                {documents.map((url, i) => (
                  <div key={url} className="py-2.5">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 text-sm font-medium text-primary hover:underline"
                    >
                      {t('detail.documentN', { n: i + 1 })}
                      <ExternalLink className="h-4 w-4 shrink-0" />
                    </a>
                  </div>
                ))}
              </PolicyCard>
            )}
          </div>
        </div>

        {footerSlot && (
          <div className="flex-shrink-0 border-t px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footerSlot}
          </div>
        )}
    </ResponsiveSheetShell>
  );
}
