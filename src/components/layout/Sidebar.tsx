import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUI } from '@/App';
import { useNotifications } from '@/store/notifications.store';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useVendorConnections } from '@/store/vendorConnections.store';
import { useAgentsRoster } from '@/store/agents.store';
import { useShipments } from '@/store/shipments.store';
import { useMagazin } from '@/store/magazin.store';
import { useStockRequests } from '@/store/stockRequests.store';
import {
  ChevronLeft,
  ChevronRight,
  Truck,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PlatformStatus } from '@/components/layout/PlatformStatus';
import { AppLogo } from '@/components/common/AppLogo';
import { PRIMARY_NAV, FOOTER_NAV, type NavItem, type NavChild, type NavBadge } from '@/config/navigation';
import { tx } from '@/i18n/tx';
import { useLanguage } from '@/i18n/useLanguage';
import { directionFor } from '@/i18n/config';
import { cn } from '@/lib/utils';

/** Left accent bar marking the active row (solid) or a parent-of-active (faded). */
function ActiveBar({ show, faded }: { show: boolean; faded?: boolean }) {
  if (!show) return null;
  return (
    <span
      className={cn(
        'absolute start-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-e-full',
        faded ? 'bg-primary/40' : 'bg-primary',
      )}
    />
  );
}

function isPathActive(itemPath: string, pathname: string): boolean {
  if (itemPath === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/';
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

const rowBase =
  'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground';

// Footer nav geometry — keep in sync with the wrapper's `py-3` and the rows'
// `space-y-1`. Used to floor the drag at exactly the two main rows.
const FOOTER_PAD_Y = 24; // py-3 top + bottom
const ROW_GAP = 4; // space-y-1

/** Grace period so the pointer can cross the gap from the icon to the flyout. */
const FLYOUT_CLOSE_DELAY = 150;

/**
 * A rail row that owns a sub-menu. Collapsed, the label and the children have
 * nowhere to render, so both move into a flyout anchored to the icon.
 *
 * Hover opens it on pointer devices; tap opens it on touch — the tablet band
 * (768–1023px) force-collapses the sidebar, so a hover-only flyout would make
 * every sub-menu unreachable there.
 */
function RailFlyout({
  side,
  label,
  trigger,
  children,
}: {
  side: 'left' | 'right';
  label: string;
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  // Focus belongs on the flyout when it was opened deliberately (click, Enter),
  // but stealing it on a mouse-over would yank focus off whatever was typing.
  const openedByHover = useRef(false);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  const onPointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    cancelClose();
    openedByHover.current = true;
    setOpen(true);
  };

  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), FLYOUT_CLOSE_DELAY);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Only Radix's own trigger/dismiss paths land here — hover goes through
        // setOpen directly — so this is always a deliberate interaction.
        cancelClose();
        openedByHover.current = false;
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        sideOffset={8}
        collisionPadding={8}
        onOpenAutoFocus={(e) => {
          if (openedByHover.current) e.preventDefault();
        }}
        onPointerEnter={cancelClose}
        onPointerLeave={onPointerLeave}
        className="w-56 p-1.5"
      >
        <p className="px-2 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="space-y-1">{children(() => setOpen(false))}</div>
      </PopoverContent>
    </Popover>
  );
}

export function Sidebar() {
  const { t } = useTranslation('nav');
  const { sidebarCollapsed, toggleSidebar, autoCollapsed } = useUI();
  const { unreadCount } = useNotifications();
  const { activeCount: shipmentsActiveCount } = useShipments();
  const { pendingActionCount } = useVendorConnections();
  const { pendingActionCount: agentActionCount } = useAgentsRoster();
  const { awaitingCount: stockRequestCount } = useStockRequests();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const roleEntity = useOnboarding().session?.role_entity;
  const { data: magazin } = useMagazin();
  const { language } = useLanguage();

  // The rail hugs the inline-start edge, so its flyouts open towards the
  // content column — that is the right side only while the UI is LTR.
  const flyoutSide = directionFor(language) === 'rtl' ? 'left' : 'right';

  // The magazin is authoritative for the business identity; the session is only
  // the first-paint fallback for the name (it carries no magazin logo at all).
  const agencyName =
    magazin?.name?.trim() || roleEntity?.agency_name || t('sidebar.fallbackAgencyName');
  const agencyLogo = magazin?.logo?.url ?? roleEntity?.logo_url ?? null;

  // Per-item manual expand overrides; otherwise a group auto-opens when a child
  // is active. Works for any item with children.
  const [manualExpanded, setManualExpanded] = useState<Record<string, boolean>>({});

  // ─── Resizable footer nav ───────────────────────────────────────────────────
  // The footer group has a draggable top edge. `footerHeight` is the user-chosen
  // height (null = natural/auto). `contentHeight` tracks the group's full natural
  // height (grows/shrinks as sub-menus expand) so we can clamp and avoid gaps.
  const footerContentRef = useRef<HTMLElement>(null);
  const [footerHeight, setFooterHeight] = useState<number | null>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    const el = footerContentRef.current;
    if (!el) return;
    const update = () => setContentHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Drag the top edge: up grows the footer (down to the natural full height),
  // down shrinks it (floor = the two main rows). Bounds are read fresh on each
  // grab so an expand/collapse in between is respected.
  const startFooterResize = (e: React.PointerEvent) => {
    if (sidebarCollapsed) return;
    e.preventDefault();
    const contentEl = footerContentRef.current;
    const naturalH = contentEl?.offsetHeight ?? 0;
    const rowH =
      (contentEl?.querySelector('button') as HTMLElement | null)?.offsetHeight ?? 40;
    const minH = FOOTER_PAD_Y + rowH * 2 + ROW_GAP;
    const startY = e.clientY;
    const startH = footerHeight ?? naturalH;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    const onMove = (ev: PointerEvent) => {
      const delta = startY - ev.clientY; // drag up → positive → taller
      setFooterHeight(Math.min(Math.max(startH + delta, minH), naturalH));
    };
    const onUp = () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Never taller than the content needs (avoids empty space when sub-menus close)
  // and only applied in the expanded sidebar.
  const footerStyle =
    !sidebarCollapsed && footerHeight != null
      ? { height: Math.min(footerHeight, contentHeight || footerHeight) }
      : undefined;

  const getBadgeCount = (badge?: NavBadge) => {
    if (badge === 'notifications') return unreadCount;
    if (badge === 'shipments') return shipmentsActiveCount;
    if (badge === 'vendorConnections') return pendingActionCount;
    if (badge === 'agentContracts') return agentActionCount;
    if (badge === 'stockRequests') return stockRequestCount;
    return 0;
  };

  const isChildActive = (child: NavChild) => isPathActive(child.path, pathname);
  const isLeafActive = (child: NavChild, parent: NavItem) =>
    child.path === parent.path ? pathname === child.path : isChildActive(child);

  const hasActiveChild = (item: NavItem) =>
    item.children?.some((c) => isLeafActive(c, item)) ?? false;
  // Keyed by `path`, not by label — the label is a translation key now, and the
  // expand state has to survive a language switch.
  const isExpanded = (item: NavItem) =>
    manualExpanded[item.path] ?? hasActiveChild(item);
  const toggleExpanded = (item: NavItem) =>
    setManualExpanded((m) => ({ ...m, [item.path]: !(m[item.path] ?? hasActiveChild(item)) }));

  const selectChild = (child: NavChild) => {
    if (child.disabled) return;
    navigate(child.path);
  };

  // Shared by the inline sub-menu and the collapsed-rail flyout.
  const renderChildRow = (child: NavChild, parent: NavItem, onNavigate?: () => void) => {
    const ChildIcon = child.icon;
    const cActive = isLeafActive(child, parent);
    return (
      <button
        key={child.path}
        onClick={() => {
          selectChild(child);
          onNavigate?.();
        }}
        disabled={child.disabled}
        className={cn(
          rowBase,
          'py-2',
          cActive && 'bg-primary/10 text-primary font-semibold hover:bg-primary/15 hover:text-primary',
          child.disabled &&
          'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-foreground',
        )}
      >
        <ActiveBar show={cActive} />
        <ChildIcon className="w-4 h-4 flex-shrink-0" />
        <span className="whitespace-nowrap overflow-hidden">{tx(t, child.labelKey)}</span>
      </button>
    );
  };

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const badgeCount = getBadgeCount(item.badge);
    const hasChildren = !!item.children?.length;
    const parentActive = isPathActive(item.path, pathname);
    const childActive = hasChildren && hasActiveChild(item);
    const open = hasChildren && isExpanded(item) && !sidebarCollapsed;

    const label = tx(t, item.labelKey);

    const onClick = () => {
      if (item.disabled) return;
      // Collapsed, a parent's click belongs to the flyout — there is no inline
      // sub-menu to expand and navigating would swallow the tap that opens it.
      if (hasChildren) {
        if (!sidebarCollapsed) toggleExpanded(item);
        return;
      }
      navigate(item.path);
    };

    const solid = parentActive && !childActive;
    const showBar = parentActive || childActive;

    const row = (
      <button
        onClick={onClick}
        disabled={item.disabled}
        className={cn(
          rowBase,
          solid && 'bg-primary/10 text-primary font-semibold hover:bg-primary/15 hover:text-primary',
          childActive && !solid && 'text-primary hover:text-primary',
          sidebarCollapsed && 'justify-center',
          item.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-foreground',
        )}
      >
        <ActiveBar show={showBar} faded={childActive && !solid} />
        <div className="relative">
          <Icon className="w-5 h-5 flex-shrink-0" />
          {badgeCount > 0 && (
            <span className="absolute -top-1.5 -end-1.5 min-w-4 h-4 px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-card">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </div>
        {!sidebarCollapsed && (
          <span className="flex-1 text-left whitespace-nowrap overflow-hidden">{label}</span>
        )}
        {!sidebarCollapsed && hasChildren && (
          <ChevronDown
            className={cn('w-4 h-4 transition-transform opacity-60', open && 'rotate-180')}
          />
        )}
      </button>
    );

    // ── Icon rail ──────────────────────────────────────────────────────────
    if (sidebarCollapsed) {
      if (hasChildren) {
        return (
          <RailFlyout key={item.path} side={flyoutSide} label={label} trigger={row}>
            {(close) => item.children!.map((child) => renderChildRow(child, item, close))}
          </RailFlyout>
        );
      }
      return (
        <Tooltip key={item.path}>
          <TooltipTrigger asChild>{row}</TooltipTrigger>
          <TooltipContent side={flyoutSide} sideOffset={8}>
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <div key={item.path} className="space-y-1">
        {row}

        {open && (
          <div className="ms-5 border-s border-border ps-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
            {item.children!.map((child) => renderChildRow(child, item))}
          </div>
        )}
      </div>
    );
  };

  const agencyMark = (
    <div className="w-9 h-9 rounded-xl overflow-hidden bg-brand-gradient shadow-brand-sm flex items-center justify-center flex-shrink-0">
      {agencyLogo ? (
        <img src={agencyLogo} alt={agencyName} crossOrigin="use-credentials" className="w-full h-full object-cover" />
      ) : (
        <Truck className="w-5 h-5 text-white" />
      )}
    </div>
  );

  return (
    <aside
      className={cn(
        'fixed start-0 top-0 z-40 h-screen bg-card border-e',
        'flex flex-col transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Top — business identity (magazin name + logo) */}
      <div
        className={cn(
          'h-16 flex items-center gap-3 border-b flex-shrink-0',
          sidebarCollapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        {sidebarCollapsed ? (
          // The name has no room in the rail, so the logo carries it on hover.
          <Tooltip>
            <TooltipTrigger asChild>{agencyMark}</TooltipTrigger>
            <TooltipContent side={flyoutSide} sideOffset={8}>
              {agencyName}
            </TooltipContent>
          </Tooltip>
        ) : (
          <>
            {agencyMark}
            <span className="font-display font-bold text-base truncate tracking-tight">{agencyName}</span>
          </>
        )}
      </div>

      {/* Primary navigation — scrolls between top and the pinned footer group */}
      <ScrollArea className="flex-1 min-h-0 py-4">
        <nav className="space-y-1 px-2">
          {PRIMARY_NAV.map(renderItem)}
        </nav>
      </ScrollArea>

      {/* Footer navigation — Account + Settings, resizable from the top edge and
          pinned just above Platform Status */}
      <div
        className={cn('relative border-t flex-shrink-0', footerStyle && 'overflow-hidden')}
        style={footerStyle}
      >
        {!sidebarCollapsed && (
          <div
            role="separator"
            aria-orientation="horizontal"
            onPointerDown={startFooterResize}
            title={t('sidebar.resizeHandle')}
            className="group absolute -top-1.5 left-0 right-0 z-10 flex h-3 cursor-row-resize items-center justify-center"
          >
            <span className="h-2 w-12 rounded-full bg-border transition-colors group-hover:bg-primary/50" />
          </div>
        )}
        <ScrollArea className={cn('h-full', footerStyle && 'overflow-y-auto')}>
          <nav ref={footerContentRef} className="space-y-1 px-2 py-4">
            {FOOTER_NAV.map(renderItem)}
          </nav>
        </ScrollArea>
      </div>

      {/* Footer — WiMall platform + health, then the collapse toggle */}
      <div className="border-t flex-shrink-0">
        {sidebarCollapsed ? (
          <div className="flex justify-center py-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative w-9 h-9">
                  <AppLogo decorative />
                  <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card p-0.5">
                    <PlatformStatus compact />
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side={flyoutSide} sideOffset={8}>
                {t('sidebar.platform')}
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3">
            <AppLogo decorative />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-bold leading-tight tracking-tight">
                {t('sidebar.platform')}
              </p>
              <PlatformStatus />
            </div>
          </div>
        )}

        {!autoCollapsed && (
          <Button
            variant="ghost"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            className={cn(
              'w-full h-10 rounded-none border-t text-xs text-muted-foreground gap-2 font-medium',
              sidebarCollapsed && 'px-0'
            )}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" />
                {t('sidebar.collapse')}
              </>
            )}
          </Button>
        )}
      </div>
    </aside>
  );
}
