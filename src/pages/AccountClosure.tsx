// Answering an administrator's request to close this agency account (ADR-A10).
//
// Reached from the `account/closure` deep link (`account.closure_requested`) and
// from `ClosureRequestBanner`. The contract is api-doc/me/role-closure.md.
//
// ⚠ Copy says **close**, never "delete" — the agency is anonymised and its
// records retained (ADR-A02 D-2).
//
// ─── The order of the page is the order of the decision ───────────────────────
//
//   1. who asked and why (`reason`, verbatim — it is the administrator's words
//      and is never translated), and by when (`expiresAt`);
//   2. what closing does, and what it LOSES (`warnings[]`) — before the button;
//   3. what must be settled first (`blockers[]`), each with where to go;
//   4. the two answers. Confirm is enabled by `canConfirm` and nothing else,
//      and sits behind a typed word plus a checkbox.

import { useMemo, useState, type ComponentType } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  Loader2,
  Package,
  Receipt,
  Scale,
  ShieldAlert,
  Truck,
  Wallet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveModal } from '@/components/common/ResponsiveModal';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/state-views';
import { PageHeader } from '@/components/layout/PageContainer';
import { formatCredits } from '@/components/billing/billing.constants';
import { useClosureRequest } from '@/store/closureRequest.store';
import { roleClosureService } from '@/services/role-closure.service';
import { endClosedRoleSession } from '@/lib/roleClosure';
import { getApiErrorMessage } from '@/lib/errors';
import { formatCurrency, formatDate, formatDateTime, formatRelativeTime } from '@/lib/format';
import { tx, type AnyTFunction } from '@/i18n/tx';
import { cn } from '@/lib/utils';
import { ApiError } from '@/types/api';
import {
  CLOSURE_DECLINE_NOTE_MAX,
  type AgencyClosureBlockerCode,
  type RoleClosureBlocker,
  type RoleClosureWarning,
} from '@/types/role-closure.types';

// ─── Blockers ─────────────────────────────────────────────────────────────────

interface BlockerMeta {
  icon: ComponentType<{ className?: string }>;
  /** Where the agency goes to settle it. */
  path: string;
}

/**
 * Every code an agency can receive, with the screen that settles it. Exhaustive
 * on purpose — a code added to the union without a row here is a build error.
 * A code the backend adds before this app ships one falls back to a generic row.
 */
const BLOCKERS: Record<AgencyClosureBlockerCode, BlockerMeta> = {
  shipments_unterminated: { icon: Truck, path: '/dashboard/shipments' },
  cod_collections_pending: { icon: Package, path: '/dashboard/shipments' },
  cod_cash_held: { icon: Banknote, path: '/dashboard/cash/summary' },
  cod_remittances_declared: { icon: Receipt, path: '/dashboard/cash/remittances' },
  cod_discrepancies_open: { icon: Scale, path: '/dashboard/cash/discrepancies' },
  payout_request_held: { icon: Wallet, path: '/dashboard/account/payout' },
  earnings_balance: { icon: Wallet, path: '/dashboard/account/payout' },
  earnings_allocations_held: { icon: CalendarClock, path: '/dashboard/account/payout' },
  agency_stock_held: { icon: Boxes, path: '/dashboard/inventory/stock' },
  storage_invoices_open: { icon: FileText, path: '/dashboard/inventory/statements' },
  stock_requests_pending: { icon: ClipboardList, path: '/dashboard/inventory/requests' },
};

function isKnownBlocker(code: string): code is AgencyClosureBlockerCode {
  return Object.prototype.hasOwnProperty.call(BLOCKERS, code);
}

/** `details.blockers` on `422 ROLE_CLOSURE_BLOCKED`, when it is the documented shape. */
function blockersFromError(err: ApiError): RoleClosureBlocker[] | null {
  const raw = (err.details as { blockers?: unknown } | undefined)?.blockers;
  if (!Array.isArray(raw)) return null;
  return raw.filter(
    (b): b is RoleClosureBlocker =>
      !!b && typeof b === 'object' && typeof (b as { code?: unknown }).code === 'string',
  );
}

function BlockerRow({ blocker }: { blocker: RoleClosureBlocker }) {
  const { t } = useTranslation('account');
  const known = isKnownBlocker(blocker.code);
  const Icon = known ? BLOCKERS[blocker.code as AgencyClosureBlockerCode].icon : AlertTriangle;
  const count = blocker.count ?? 0;
  const amount =
    typeof blocker.amount === 'number' ? formatCurrency(blocker.amount, blocker.currency ?? 'XAF') : null;

  return (
    <li className="flex items-start gap-3 p-4">
      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium">
          {known
            ? tx(t, `closure.blockers.codes.${blocker.code}.title`, { count, amount })
            : t('closure.blockers.unknown.title', { code: blocker.code })}
        </p>
        <p className="text-sm text-muted-foreground">
          {known
            ? tx(t, `closure.blockers.codes.${blocker.code}.action`)
            : t('closure.blockers.unknown.action')}
        </p>
      </div>
      {known && (
        <Button asChild size="sm" variant="outline" className="flex-shrink-0 gap-1.5">
          <Link to={BLOCKERS[blocker.code as AgencyClosureBlockerCode].path}>
            {t('closure.blockers.open')}
            <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
          </Link>
        </Button>
      )}
    </li>
  );
}

// ─── Warnings ─────────────────────────────────────────────────────────────────

function warningText(t: AnyTFunction, w: RoleClosureWarning): string {
  const plan = w.planCode ?? tx(t, 'account:closure.warnings.planFallback');
  switch (w.code) {
    case 'prepaid_plan_forfeited':
      return w.expiresAt
        ? tx(t, 'account:closure.warnings.prepaidPlan', { plan, date: formatDate(w.expiresAt) })
        : tx(t, 'account:closure.warnings.prepaidPlanNoDate', { plan });
    case 'credit_balance_forfeited':
      return tx(t, 'account:closure.warnings.credits', { amount: formatCredits(w.amount ?? 0) });
    default:
      return tx(t, 'account:closure.warnings.unknown');
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AccountClosure() {
  const { t } = useTranslation(['account', 'nav', 'common']);
  const navigate = useNavigate();
  const { request, isLoading, error, refetch, setRequest } = useClosureRequest();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'confirm' | 'decline' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // The word the owner types. Localized — the API's English phrase is sent by
  // this app, not by the person — and compared without regard to case.
  const confirmWord = t('closure.confirm.word');
  const wordMatches = typed.trim().toLocaleUpperCase() === confirmWord.toLocaleUpperCase();

  const blockers = useMemo(() => request?.blockers ?? [], [request]);

  const header = (
    <PageHeader
      parent={t('nav:footer.account')}
      title={t('closure.title')}
      description={t('closure.description')}
    />
  );

  /**
   * The request moved between our read and our write — it expired, or an
   * administrator cancelled it. Re-read rather than guess.
   */
  const onStale = async (err: unknown) => {
    toast.error(getApiErrorMessage(err));
    setConfirmOpen(false);
    setDeclineOpen(false);
    await refetch();
  };

  const onConfirm = async () => {
    setBusy('confirm');
    setActionError(null);
    try {
      const res = await roleClosureService.confirm();
      const outcome = res.data.outcome;
      // A 200 always carries an outcome; without one, treat it as the
      // conservative case — the agency role is gone, the account may not be.
      await endClosedRoleSession(
        outcome ?? { accountClosed: false, closedAt: new Date().toISOString(), endedRelationships: 0 },
      );
      // `endClosedRoleSession` dispatched `auth:logout`; the routers already
      // took the user to the right place. Nothing else may run on this screen.
    } catch (err) {
      setBusy(null);
      if (err instanceof ApiError) {
        if (err.code === 'ROLE_CLOSURE_BLOCKED') {
          // Something live appeared since the page loaded. Show the fresh list
          // and do not retry — the button stays off until it is settled.
          const fresh = blockersFromError(err);
          setRequest((prev) =>
            prev ? { ...prev, blockers: fresh ?? prev.blockers, canConfirm: false } : prev,
          );
          setConfirmOpen(false);
          setActionError(getApiErrorMessage(err));
          return;
        }
        if (err.code === 'ROLE_CLOSURE_REQUEST_EXPIRED' || err.code === 'ROLE_CLOSURE_REQUEST_NOT_FOUND') {
          await onStale(err);
          return;
        }
      }
      setActionError(getApiErrorMessage(err));
    }
  };

  const onDecline = async () => {
    setBusy('decline');
    setActionError(null);
    try {
      await roleClosureService.decline(note);
      setDeclineOpen(false);
      setRequest(null);
      toast.success(t('closure.decline.done'));
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.code === 'ROLE_CLOSURE_REQUEST_EXPIRED' || err.code === 'ROLE_CLOSURE_REQUEST_NOT_FOUND')
      ) {
        await onStale(err);
      } else {
        setActionError(getApiErrorMessage(err));
      }
    } finally {
      setBusy(null);
    }
  };

  const openConfirm = () => {
    setAcknowledged(false);
    setTyped('');
    setActionError(null);
    setConfirmOpen(true);
  };

  if (isLoading && !request) {
    return (
      <div className="space-y-6 animate-fade-in">
        {header}
        <LoadingState className="py-24" />
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="space-y-6 animate-fade-in">
        {header}
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="space-y-6 animate-fade-in">
        {header}
        <EmptyState
          icon={CheckCircle2}
          title={t('closure.none.title')}
          description={t('closure.none.body')}
          action={
            <Button asChild variant="outline">
              <Link to="/dashboard">{t('closure.none.back')}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const canConfirm = request.canConfirm;
  const isPending = request.status === 'pending';

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      {header}

      {/* 1 — who asked, why, and by when. */}
      <Card className="py-0 border-destructive/30">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">{t('closure.request.title')}</p>
              <p className="text-sm text-muted-foreground">
                {t('closure.request.requestedAt', { date: formatDateTime(request.requestedAt) })}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('closure.request.reasonLabel')}
            </p>
            {/* Verbatim and untranslated; `dir="auto"` so an Arabic UI does not
                flip a French sentence. */}
            <blockquote
              dir="auto"
              className="whitespace-pre-line break-words rounded-lg border bg-muted/50 px-4 py-3 text-sm italic"
            >
              {request.reason}
            </blockquote>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <CalendarClock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span>
              {isPending
                ? t('closure.request.expiresAt', {
                    date: formatDateTime(request.expiresAt),
                    relative: formatRelativeTime(request.expiresAt),
                  })
                : t('closure.request.notPending')}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 2 — what closing does, and what it costs. Before the button. */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">{t('closure.effects.title')}</h2>
        <Card className="py-0">
          <CardContent className="p-5">
            <ul className="list-disc space-y-1.5 ps-5 text-sm">
              <li>{t('closure.effects.deactivated')}</li>
              <li>{t('closure.effects.agents')}</li>
              <li>{t('closure.effects.vendors')}</li>
              <li>{t('closure.effects.products')}</li>
              <li>{t('closure.effects.records')}</li>
              <li className="font-medium">{t('closure.effects.irreversible')}</li>
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">{t('closure.effects.otherRoles')}</p>
          </CardContent>
        </Card>

        {request.warnings.length > 0 && (
          <Card className="py-0 border-gold-400/50 bg-gold-50/70 dark:border-gold-500/25 dark:bg-gold-500/10">
            <CardContent className="space-y-2 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-gold-800 dark:text-gold-300">
                <CreditCard className="h-4 w-4" />
                {t('closure.warnings.title')}
              </p>
              <ul className="list-disc space-y-1 ps-5 text-sm">
                {request.warnings.map((w, i) => (
                  <li key={`${w.code}-${i}`}>{warningText(t as AnyTFunction, w)}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {/* 3 — what must be settled first. */}
      {isPending && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">{t('closure.blockers.title')}</h2>
          {blockers.length === 0 ? (
            <Card className="py-0">
              <CardContent className="flex items-center gap-3 p-4 text-sm">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
                {t('closure.blockers.none')}
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {t('closure.blockers.intro', { count: blockers.length })}
              </p>
              <Card className="py-0">
                <ul className="divide-y">
                  {blockers.map((b) => (
                    <BlockerRow key={b.code} blocker={b} />
                  ))}
                </ul>
              </Card>
              <Button variant="ghost" size="sm" onClick={() => void refetch()} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('closure.blockers.recheck')}
              </Button>
            </>
          )}
        </section>
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {actionError}
        </div>
      )}

      {/* 4 — the two answers. */}
      {isPending && (
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setActionError(null);
              setDeclineOpen(true);
            }}
            disabled={busy !== null}
          >
            {t('closure.decline.cta')}
          </Button>
          <Button variant="destructive" onClick={openConfirm} disabled={!canConfirm || busy !== null}>
            {t('closure.confirm.cta')}
          </Button>
        </div>
      )}
      {isPending && !canConfirm && (
        <p className="text-end text-xs text-muted-foreground">{t('closure.confirm.disabledHint')}</p>
      )}

      {/* The deliberate step. */}
      <ResponsiveModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        disableClose={busy === 'confirm'}
        title={t('closure.confirm.title')}
        description={t('closure.confirm.description')}
        mobileClassName="h-auto max-h-[92dvh]"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy === 'confirm'}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void onConfirm()}
              disabled={!acknowledged || !wordMatches || busy === 'confirm'}
            >
              {busy === 'confirm' && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('closure.confirm.submit')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="closure-ack"
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="closure-ack" className="text-sm font-normal leading-snug">
              {t('closure.confirm.acknowledge')}
            </Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="closure-word">{t('closure.confirm.typeLabel', { word: confirmWord })}</Label>
            <Input
              id="closure-word"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmWord}
              className={cn(typed && !wordMatches && 'border-destructive/50')}
            />
          </div>
          {actionError && (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          )}
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        disableClose={busy === 'decline'}
        title={t('closure.decline.title')}
        description={t('closure.decline.description')}
        mobileClassName="h-auto max-h-[92dvh]"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeclineOpen(false)} disabled={busy === 'decline'}>
              {t('common:actions.cancel')}
            </Button>
            <Button onClick={() => void onDecline()} disabled={busy === 'decline'}>
              {busy === 'decline' && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('closure.decline.submit')}
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="closure-note">{t('closure.decline.noteLabel')}</Label>
          <Textarea
            id="closure-note"
            value={note}
            maxLength={CLOSURE_DECLINE_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('closure.decline.notePlaceholder')}
            className="min-h-24"
          />
          <p className="text-end text-xs text-muted-foreground">
            {note.length}/{CLOSURE_DECLINE_NOTE_MAX}
          </p>
          {actionError && (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          )}
        </div>
      </ResponsiveModal>
    </div>
  );
}
