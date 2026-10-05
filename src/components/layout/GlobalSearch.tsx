import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Command as CommandPrimitive } from 'cmdk';
import { ArrowLeft, CornerDownLeft, Loader2, Search, SearchX, Truck } from 'lucide-react';

import { cn } from '@/lib/utils';
import { tx, type AnyTFunction } from '@/i18n/tx';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ShipmentStatusBadge } from '@/components/shipments/ShipmentStatusBadge';
import { ALL_NAV, type NavChild, type NavItem } from '@/config/navigation';
import { QUICK_ACTIONS, type QuickAction } from '@/config/quickActions';
import { shipmentsService } from '@/services/shipments.service';
import type { ShipmentListItem } from '@/types/shipment.types';

/**
 * The header's ⌘K palette: dashboard pages, quick actions, and shipments.
 *
 * Pages and actions are filtered here, on the client — they are the static nav
 * table. Shipments come from `GET /agency/shipments?q=` (customer name/phone,
 * product title, order number, tracking number; min 2 chars), debounced, so a
 * tracking number pasted from a WhatsApp message lands on its shipment.
 *
 * cmdk's own filter is off (`shouldFilter={false}`): it would also filter the
 * server's shipment hits against the raw query, hiding a match on a customer
 * phone the row does not print. Keyboard (↑ ↓ ↵) is still cmdk's.
 *
 * Full screen on a phone (the keyboard takes half the viewport; a floating card
 * would leave three results visible), a top-anchored card on desktop.
 */

const SHIPMENT_MIN_CHARS = 2;
const SHIPMENT_LIMIT = 6;
const DEBOUNCE_MS = 250;

/** Lowercase, accent-free — "expé" finds "Expéditions", "expe" does too. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

interface PageEntry {
  path: string;
  label: string;
  /** The parent menu, for a child page ("Agents › Browse"). */
  parent?: string;
  icon: NavItem['icon'];
}

/** Every navigable page: leaves, and parents that have no submenu. */
function flattenNav(t: AnyTFunction): PageEntry[] {
  const out: PageEntry[] = [];
  for (const item of ALL_NAV) {
    if (item.disabled) continue;
    const parentLabel = tx(t, item.labelKey);
    if (!item.children?.length) {
      out.push({ path: item.path, label: parentLabel, icon: item.icon });
      continue;
    }
    for (const child of item.children as NavChild[]) {
      if (child.disabled) continue;
      out.push({ path: child.path, label: tx(t, child.labelKey), parent: parentLabel, icon: child.icon });
    }
  }
  return out;
}

/** 0 = no match; higher ranks first. Prefix of the label beats a word-start beats a substring. */
function score(query: string, ...fields: (string | undefined)[]): number {
  if (!query) return 1;
  let best = 0;
  fields.forEach((field, i) => {
    if (!field) return;
    const f = fold(field);
    const weight = i === 0 ? 3 : 1;
    if (f.startsWith(query)) best = Math.max(best, 3 * weight);
    else if (f.split(/[\s›/-]+/).some((w) => w.startsWith(query))) best = Math.max(best, 2 * weight);
    else if (f.includes(query)) best = Math.max(best, 1 * weight);
  });
  return best;
}

/**
 * The phone's way in: a magnifier beside the notification bell in the app bar.
 * The desktop `Header` (and its ⌘K button) is not rendered below `md`.
 */
export function MobileSearchButton({ className }: { className?: string }) {
  const { t } = useTranslation('nav');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('header.searchLabel')}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <Search className="h-5 w-5" />
      </button>
      <GlobalSearch open={open} onOpenChange={setOpen} />
    </>
  );
}

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('nav');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0',
          // Phone: the whole screen, above the keyboard (`dvh` follows it).
          // `!` on the width: the base dialog's `sm:max-w-lg` matches 640–767px
          // too, and two media-query utilities would be decided by CSS order.
          'max-md:inset-0 max-md:left-0 max-md:top-0 max-md:h-[100dvh] max-md:max-h-none max-md:w-full max-md:!max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0',
          // Desktop: anchored near the top, so the list grows downward
          // instead of the box jumping as results arrive.
          'md:top-[12vh] md:max-h-[76vh] md:translate-y-0 md:max-w-2xl',
        )}
      >
        <DialogTitle className="sr-only">{t('header.searchLabel')}</DialogTitle>
        <DialogDescription className="sr-only">{t('header.searchPlaceholder')}</DialogDescription>
        {/* Its own component so a closed dialog unmounts it — every opening
            starts from an empty query with no reset code to keep in step. */}
        <SearchPanel onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

interface ShipmentResult {
  /** The query these rows answer. */
  q: string;
  data: ShipmentListItem[];
  failed: boolean;
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(['nav', 'common']);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [result, setResult] = useState<ShipmentResult | null>(null);
  /** The row the user moved to with ↑↓ / hover; `null` = follow the first. */
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (debounced.length < SHIPMENT_MIN_CHARS) return;
    let cancelled = false;
    shipmentsService
      // The server caps `q` at 100 chars.
      .list({ q: debounced.slice(0, 100), page: 1, limit: SHIPMENT_LIMIT })
      .then((res) => {
        if (!cancelled) setResult({ q: debounced, data: res.data, failed: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ q: debounced, data: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const trimmed = query.trim();
  const searchingShipments = trimmed.length >= SHIPMENT_MIN_CHARS;
  // The last answer stays up while the next one is on its way — rows blinking
  // out on every keystroke read as "no match" for a moment.
  const shipments = searchingShipments ? (result?.data ?? []) : [];
  const shipmentsFailed = searchingShipments && result?.q === trimmed && result.failed;
  const waitingOnShipments = searchingShipments && result?.q !== trimmed;

  const pages = useMemo(() => flattenNav(t), [t]);
  const q = fold(query);

  const pageHits = useMemo(
    () =>
      pages
        .map((p) => ({ p, s: score(q, p.label, p.parent) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, q ? 8 : 0)
        .map((x) => x.p),
    [pages, q],
  );

  const actionHits = useMemo(
    () =>
      QUICK_ACTIONS.filter(
        (a) => score(q, tx(t, a.labelKey), tx(t, a.descriptionKey)) > 0,
      ),
    [q, t],
  );

  const go = (path: string, state?: unknown) => {
    onClose();
    navigate(path, state ? { state } : undefined);
  };

  const runAction = (action: QuickAction) =>
    go(`/dashboard/${action.route}`, action.intent ? { create: true } : undefined);

  // The highlighted row is the FIRST one until the user moves it. Shipments
  // arrive after the pages do, and cmdk would otherwise keep the page it had
  // already selected — so ↵ on a pasted tracking number opened "Shipments".
  const firstValue = shipments[0]
    ? `shipment:${shipments[0].id}`
    : pageHits[0]
      ? `page:${pageHits[0].path}`
      : actionHits[0]
        ? `action:${actionHits[0].id}`
        : '';

  const nothing =
    !!q && pageHits.length === 0 && actionHits.length === 0 && shipments.length === 0 && !waitingOnShipments;

  const groupClass =
    'px-2 py-1.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground';
  const itemClass =
    'flex cursor-pointer select-none items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground max-md:py-3';

  return (
    <CommandPrimitive
      shouldFilter={false}
      loop
      value={picked ?? firstValue}
      onValueChange={setPicked}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex shrink-0 items-center gap-2 border-b px-3 pt-[env(safe-area-inset-top)] md:px-4">
        {isMobile ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('header.closeSearch')}
            className="-ms-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" />
          </button>
        ) : (
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
        <CommandPrimitive.Input
          autoFocus
          value={query}
          onValueChange={(v) => {
            setQuery(v);
            setPicked(null);
          }}
          placeholder={t('header.searchPlaceholder')}
          // 16px on a phone: anything smaller makes iOS zoom the page on focus.
          // `!outline-none`: index.css rings every `input:focus-visible`, and
          // that element selector outranks a utility. The whole bar is the
          // field here — a box drawn inside it read as a second input.
          className="h-14 w-full min-w-0 bg-transparent text-base !outline-none placeholder:text-muted-foreground md:text-lg"
        />
        {waitingOnShipments && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
        {!isMobile && (
          <kbd className="hidden h-6 shrink-0 select-none items-center rounded border bg-muted px-2 font-mono text-[11px] font-medium text-muted-foreground sm:inline-flex">
            ESC
          </kbd>
        )}
      </div>

      <CommandPrimitive.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        {nothing && (
          <div className="px-6 py-12 text-center">
            <SearchX className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-50" />
            <p className="text-sm font-medium">{t('header.noResults', { query: query.trim() })}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('header.noResultsHint')}</p>
          </div>
        )}

        {shipments.length > 0 && (
          <CommandPrimitive.Group heading={t('header.searchGroups.shipments')} className={groupClass}>
            {shipments.map((s) => (
              <CommandPrimitive.Item
                key={s.id}
                value={`shipment:${s.id}`}
                onSelect={() => go(`/dashboard/shipments?open=${encodeURIComponent(s.id)}`)}
                className={itemClass}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Truck className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.orderNumber}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[s.customer?.name, s.trackingNumber].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <ShipmentStatusBadge status={s.status} className="shrink-0 text-[10px]" />
              </CommandPrimitive.Item>
            ))}
          </CommandPrimitive.Group>
        )}

        {shipmentsFailed && (
          <p className="px-5 py-2 text-xs text-muted-foreground">{t('header.searchShipmentsFailed')}</p>
        )}

        {pageHits.length > 0 && (
          <CommandPrimitive.Group heading={t('header.searchGroups.pages')} className={groupClass}>
            {pageHits.map((p) => (
              <CommandPrimitive.Item
                key={p.path}
                value={`page:${p.path}`}
                onSelect={() => go(p.path)}
                className={itemClass}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <p.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {p.parent && <span className="text-muted-foreground">{p.parent} › </span>}
                  <span className="font-medium">{p.label}</span>
                </span>
              </CommandPrimitive.Item>
            ))}
          </CommandPrimitive.Group>
        )}

        {actionHits.length > 0 && (
          <CommandPrimitive.Group heading={t('header.quickActions')} className={groupClass}>
            {actionHits.map((action) => (
              <CommandPrimitive.Item
                key={action.id}
                value={`action:${action.id}`}
                onSelect={() => runAction(action)}
                className={itemClass}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <action.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{tx(t, action.labelKey)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {tx(t, action.descriptionKey)}
                  </span>
                </span>
              </CommandPrimitive.Item>
            ))}
          </CommandPrimitive.Group>
        )}
      </CommandPrimitive.List>

      {/* Keyboard legend — meaningless on a touch screen. */}
      {!isMobile && (
        <div className="flex shrink-0 items-center justify-between border-t bg-muted/50 px-4 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1.5 py-0.5">↑↓</kbd>
              {t('header.hintNavigate')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1.5 py-0.5">
                <CornerDownLeft className="h-3 w-3" />
              </kbd>
              {t('header.hintSelect')}
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1.5 py-0.5">esc</kbd>
            {t('header.hintClose')}
          </span>
        </div>
      )}
    </CommandPrimitive>
  );
}
