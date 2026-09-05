import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Store } from 'lucide-react';
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
import { vendorConnectionsService, resolveVendorDisplayForConnections } from '@/services/vendor-connections.service';
import { getApiErrorMessage } from '@/lib/errors';
import { ConnectionStatusBadge } from '@/components/vendors/ConnectionStatusBadge';
import type { ConnectionDto, ConnectionStatus, VendorBrowseItemDto } from '@/types/vendor-connection.types';

type StatusChip = 'all' | 'pending' | 'active' | 'paused_reapproval' | 'history';

const HISTORY_STATUSES: ConnectionStatus[] = ['rejected', 'withdrawn', 'terminated'];

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
  const [vendorDisplay, setVendorDisplay] = useState<Map<string, VendorBrowseItemDto>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chip, setChip] = useState<StatusChip>('all');
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
        next[idx] = dto;
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
      const { resolved } = await resolveVendorDisplayForConnections(all);
      setVendorDisplay(resolved);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** The name shown on a row — also what the search box matches against. */
  const nameFor = (connection: ConnectionDto): string => {
    const vendor = vendorDisplay.get(connection.vendorId);
    return (
      vendor?.displayName ??
      vendor?.businessName ??
      t('connections.fallbackName', { suffix: connection.vendorId.slice(-6) })
    );
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
            const vendor = vendorDisplay.get(connection.vendorId);
            return (
              <div
                key={connection.id}
                className="flex items-center justify-between gap-3 p-4 md:rounded-xl md:border md:border-border md:p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {vendor?.logoUrl ? (
                      <img src={vendor.logoUrl} alt={vendor.businessName} className="w-full h-full object-cover" />
                    ) : (
                      <Store className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{nameFor(connection)}</p>
                    <ConnectionStatusBadge status={connection.status} className="text-[10px] mt-0.5" />
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <ConnectionRowActions connection={connection} actions={actions} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
