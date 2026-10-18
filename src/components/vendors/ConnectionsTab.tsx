import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Store } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { useVendorConnectionActions } from '@/hooks/useVendorConnectionActions';
import { vendorConnectionsService, findVendorInBrowse } from '@/services/vendor-connections.service';
import { resolveFileUrl } from '@/services/files.service';
import { getApiErrorMessage } from '@/lib/errors';
import { ConnectionStatusBadge } from '@/components/vendors/ConnectionStatusBadge';
import { VendorAccountStatusBadge } from '@/components/vendors/VendorAccountStatusBadge';
import { VendorCodTerms } from '@/components/vendors/VendorCodTerms';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { PolicyTermsButton } from '@/components/common/PolicyTermsButton';
import { VendorDetailSheet } from '@/components/vendors/VendorDetailSheet';
import { cn } from '@/lib/utils';
import {
  useOpenParam,
  useHighlightRow,
  rowDomId,
  HIGHLIGHT_CLASS,
} from '@/hooks/useOpenParam';
import {
  endedByVendorClosure,
  type ConnectionDto,
  type ConnectionStatus,
  type VendorBrowseItemDto,
} from '@/types/vendor-connection.types';
import { usePageRefresh } from '@/store/pageRefresh.store';

/** DOM-id prefix for a deep-linked connection row. */
const CONNECTION_ROW = 'connection';

type StatusChip = 'all' | 'pending' | 'active' | 'paused_reapproval' | 'history';

const HISTORY_STATUSES: ConnectionStatus[] = ['rejected', 'withdrawn', 'terminated'];

/** Up to two initials for the logo tile when the vendor has no logo. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function matchesChip(status: ConnectionStatus, chip: StatusChip): boolean {
  if (chip === 'all') return true;
  if (chip === 'history') return HISTORY_STATUSES.includes(status);
  return status === chip;
}

function ReasonPopover({
  triggerLabel,
  confirmLabel,
  placeholder,
  variant,
  disabled,
  onConfirm,
}: {
  triggerLabel: string;
  confirmLabel: string;
  placeholder: string;
  variant?: 'outline' | 'destructive';
  disabled: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  // `triggerLabel` / `confirmLabel` / `placeholder` arrive already translated
  // from the caller, which knows whether this is a rejection or a termination.

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant={variant ?? 'outline'}>{triggerLabel}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2" align="end">
        <Textarea
          placeholder={placeholder}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="text-xs min-h-16"
        />
        <Button
          size="sm"
          variant={variant ?? 'default'}
          className="w-full"
          disabled={disabled}
          onClick={() => { onConfirm(reason); setOpen(false); setReason(''); }}
        >
          {disabled ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : confirmLabel}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function ConnectionRowActions({
  connection,
  actions,
}: {
  connection: ConnectionDto;
  actions: ReturnType<typeof useVendorConnectionActions>;
}) {
  const { t } = useTranslation('vendors');
  const vendorId = connection.vendorId;

  if (connection.status === 'pending') {
    if (connection.requesterRole === 'agency') {
      const key = `withdraw:${connection.id}`;
      return (
        <Button
          size="sm"
          variant="outline"
          disabled={actions.pendingKey === key}
          onClick={() => actions.withdraw(vendorId, connection.id)}
        >
          {actions.pendingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('actions.withdraw')}
        </Button>
      );
    }
    const approveKey = `approve:${connection.id}`;
    const rejectKey = `reject:${connection.id}`;
    return (
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          disabled={actions.pendingKey === approveKey}
          onClick={() => actions.approve(vendorId, connection.id)}
        >
          {actions.pendingKey === approveKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('actions.approve')}
        </Button>
        <ReasonPopover
          triggerLabel={t('actions.reject')}
          confirmLabel={t('actions.confirmReject')}
          placeholder={t('actions.reasonOptional')}
          variant="destructive"
          disabled={actions.pendingKey === rejectKey}
          onConfirm={(reason) => actions.reject(vendorId, connection.id, reason || undefined)}
        />
      </div>
    );
  }

  if (connection.status === 'active') {
    const key = `terminate:${connection.id}`;
    return (
      <ReasonPopover
        triggerLabel={t('actions.terminate')}
        confirmLabel={t('actions.confirmTerminate')}
        placeholder={t('actions.noteOptional')}
        variant="destructive"
        disabled={actions.pendingKey === key}
        onConfirm={(note) => actions.terminate(vendorId, connection.id, note || undefined)}
      />
    );
  }

  if (connection.status === 'paused_reapproval') {
    if (connection.reapprovalRequiredFrom === 'agency') {
      const key = `approve:${connection.id}`;
      return (
        <Button
          size="sm"
          disabled={actions.pendingKey === key}
          onClick={() => actions.approve(vendorId, connection.id)}
        >
          {actions.pendingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('actions.reapprove')}
        </Button>
      );
    }
    return <Badge variant="secondary">{t('actions.awaitingVendor')}</Badge>;
  }

  // The vendor closed its account — there is nobody left to ask.
  if (endedByVendorClosure(connection)) return null;

  // rejected / withdrawn / terminated
  const key = `request:${vendorId}`;
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={actions.pendingKey === key}
      onClick={() => actions.request(vendorId)}
    >
      {actions.pendingKey === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('actions.requestAgain')}
    </Button>
  );
}

export interface ConnectionsTabProps {
  /** Called after any successful mutation, so the parent can refresh the shared pending-action badge. */
  onConnectionChange?: () => void;
}

/** Vendors → Connections tab: status-filtered history of all the agency's vendor connections. */
export function ConnectionsTab({ onConnectionChange }: ConnectionsTabProps) {
  const { t } = useTranslation(['vendors', 'common']);
  const [connections, setConnections] = useState<ConnectionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chip, setChip] = useState<StatusChip>('all');
  const [detailVendor, setDetailVendor] = useState<VendorBrowseItemDto | null>(null);
  /** The connection whose terms sheet is being fetched — one at a time. */
  const [termsLoadingFor, setTermsLoadingFor] = useState<string | null>(null);

  // `?open=<connectionId>` — where the four `connection.*` notifications land
  // (`vendor-connections/{id}`, api-doc/notifications/deep-links.md). There is
  // no detail sheet here, so the deep link scrolls to the connection and rings
  // it rather than opening one.
  const { openId } = useOpenParam();
  const highlighted = useHighlightRow(CONNECTION_ROW, openId);
  const [search, setSearch] = useState('');

  const statusOptions = useMemo(
    () => [
      { value: 'all' as const, label: t('connections.all') },
      { value: 'pending' as const, label: t('status.pending') },
      { value: 'active' as const, label: t('status.active') },
      { value: 'paused_reapproval' as const, label: t('connections.paused') },
      { value: 'history' as const, label: t('connections.history') },
    ],
    [t],
  );

  const actions = useVendorConnectionActions({
    onChanged: (_vendorId, dto) => {
      setConnections((prev) => {
        const idx = prev.findIndex((c) => c.id === dto.id);
        if (idx === -1) return [dto, ...prev];
        const next = [...prev];
        // A mutation response may not carry `vendorCodTerms` (only `GET /` and
        // `GET /:id` are documented to) — keep the terms the list already had.
        // `counterpartyStatus` / `counterpartyProfile` are on every response,
        // but not from a backend older than 2026-10-18; keep the row's then too.
        next[idx] = {
          ...dto,
          vendorCodTerms: dto.vendorCodTerms === undefined ? prev[idx].vendorCodTerms : dto.vendorCodTerms,
          counterpartyStatus:
            dto.counterpartyStatus === undefined ? prev[idx].counterpartyStatus : dto.counterpartyStatus,
          counterpartyProfile:
            dto.counterpartyProfile === undefined ? prev[idx].counterpartyProfile : dto.counterpartyProfile,
        };
        return next;
      });
      onConnectionChange?.();
    },
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const all: ConnectionDto[] = [];
      let page = 1;
      let totalPages = 1;
      const maxPages = 10; // 10 * 100 = 1000 connections, a generous ceiling
      while (page <= totalPages && page <= maxPages) {
        const { data, meta } = await vendorConnectionsService.list({ page, limit: 100 });
        all.push(...data);
        totalPages = meta.totalPages;
        page += 1;
      }
      setConnections(all);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePageRefresh(load, isLoading);

  /**
   * The vendor's own name, or `null` when it has none to show. `businessName`
   * is the Store name and `''` before a Store exists, hence `||`, not `??`.
   */
  const realNameFor = (connection: ConnectionDto): string | null => {
    const profile = connection.counterpartyProfile;
    return profile?.businessName || profile?.displayName || null;
  };

  /** The name shown on a row — also what the search box matches against. */
  const nameFor = (connection: ConnectionDto): string =>
    realNameFor(connection) ?? t('connections.fallbackName', { suffix: connection.vendorId.slice(-6) });

  /**
   * Open the vendor's terms sheet. Policies and COD terms are only on browse,
   * so this fetches the one vendor now rather than every vendor on load.
   */
  const openTerms = async (connection: ConnectionDto, name: string) => {
    if (termsLoadingFor) return;
    setTermsLoadingFor(connection.id);
    try {
      const vendor = await findVendorInBrowse(connection.vendorId, name);
      if (vendor) setDetailVendor(vendor);
      else toast.error(t('connections.termsUnavailable'));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setTermsLoadingFor(null);
    }
  };

  const query = search.trim().toLowerCase();
  const filtered = connections.filter(
    (c) => matchesChip(c.status, chip) && (!query || nameFor(c).toLowerCase().includes(query)),
  );

  return (
    <div className="space-y-3">
      <SearchFilterBar
        value={search}
        onChange={setSearch}
        placeholder={t('connections.searchPlaceholder')}
        searchLabel={t('connections.searchLabel')}
        activeCount={chip === 'all' ? 0 : 1}
        onReset={() => setChip('all')}
        filterDescription={t('connections.filterDescription')}
        resultCount={filtered.length}
        resultNounKey="common:nouns.connection"
      >
        <FilterSection label={t('connections.statusFilter')}>
          <FilterOptionGroup value={chip} onChange={setChip} options={statusOptions} />
        </FilterSection>
      </SearchFilterBar>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> {t('connections.loading')}
        </div>
      ) : loadError ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
          <Button variant="outline" onClick={load}>{t('common:actions.retry')}</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 border border-dashed rounded-xl">
          <Store className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {query ? t('connections.emptyFiltered') : t('connections.empty')}
          </p>
        </div>
      ) : (
        <div className="-mx-4 divide-y border-y sm:-mx-6 md:mx-0 md:space-y-2 md:divide-y-0 md:border-y-0">
          {filtered.map((connection) => {
            const profile = connection.counterpartyProfile;
            const realName = realNameFor(connection);
            const logoUrl = profile?.logo ? resolveFileUrl(profile.logo) : null;
            // Browse lists `active` vendors only, so the terms of one that is
            // not active cannot be fetched — no button rather than one that
            // always fails. A backend that does not send the status yet: try.
            const termsReachable =
              realName !== null &&
              connection.counterpartyStatus !== 'pending_verification' &&
              connection.counterpartyStatus !== 'inactive' &&
              connection.counterpartyStatus !== null;
            // Approve + Reject beside the name do not fit a 360px row; they
            // take a line of their own below it on a phone, split evenly.
            const twoActions =
              connection.status === 'pending' && connection.requesterRole !== 'agency';
            return (
              <div
                key={connection.id}
                id={rowDomId(CONNECTION_ROW, connection.id)}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 p-4 md:flex-nowrap md:rounded-xl md:border md:border-border md:p-3',
                  highlighted === connection.id && HIGHLIGHT_CLASS,
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="w-full h-full object-cover" />
                    ) : realName ? (
                      <span aria-hidden className="text-xs font-semibold text-muted-foreground">
                        {initialsOf(realName)}
                      </span>
                    ) : (
                      <Store className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 min-w-0">
                      <p className="text-sm font-medium truncate min-w-0">{nameFor(connection)}</p>
                      <VerifiedBadge verified={profile?.kycVerified} />
                    </div>
                    {/* The connection's state, then the vendor's own account
                        state. Approve stays available either way. */}
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <ConnectionStatusBadge status={connection.status} className="text-[10px]" />
                      <VendorAccountStatusBadge status={connection.counterpartyStatus} className="text-[10px]" />
                    </div>
                    {endedByVendorClosure(connection) ? (
                      <p className="mt-1 text-xs text-muted-foreground">{t('connections.endedByClosure')}</p>
                    ) : (
                      <VendorCodTerms terms={connection.vendorCodTerms} className="mt-1" />
                    )}
                  </div>
                  {/* The same terms sheet as Browse — what was agreed to by
                      connecting stays one tap away after connecting. */}
                  {termsReachable && (
                    <PolicyTermsButton
                      label={t('connections.viewPolicies', { name: realName })}
                      onClick={() => void openTerms(connection, realName)}
                      className={cn('ms-auto', termsLoadingFor === connection.id && 'animate-pulse')}
                    />
                  )}
                </div>
                <div
                  className={cn(
                    'flex-shrink-0',
                    // One height for both: Reject sits inside a popover trigger
                    // and came out shorter than Approve beside it. 40px is the
                    // phone's tap target anyway.
                    twoActions &&
                      'max-md:basis-full max-md:[&>div]:w-full max-md:[&_button]:h-10 max-md:[&_button]:flex-1',
                  )}
                >
                  <ConnectionRowActions connection={connection} actions={actions} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <VendorDetailSheet
        vendor={detailVendor}
        open={!!detailVendor}
        onOpenChange={(open) => !open && setDetailVendor(null)}
      />
    </div>
  );
}
