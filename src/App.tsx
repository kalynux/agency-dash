import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';

// Dashboard pages
import { Overview } from '@/pages/Overview';
import { Shipments } from '@/pages/Shipments';
import { Inventory } from '@/pages/Inventory';
import { LiveTracking } from '@/pages/LiveTracking';
import { Notifications } from '@/pages/Notifications';
import { Tickets } from '@/pages/Tickets';
import { Agents } from '@/pages/Agents';
import { CashManagement } from '@/pages/CashManagement';
import { Vendors } from '@/pages/Vendors';
import { Transactions } from '@/pages/Transactions';
import { MediaLibrary } from '@/pages/MediaLibrary';
import { Account } from '@/pages/Account';
import { Settings } from '@/pages/Settings';

// Auth pages — the only screens that render outside the dashboard chrome.
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { ForgotPassword } from '@/pages/ForgotPassword';

// Layout
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { OfflineBanner } from '@/components/layout/OfflineBanner';
import { StatusBarScrim } from '@/components/layout/StatusBarScrim';
import { useIsMobile, useIsBelowDesktop } from '@/hooks/use-mobile';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import { MOBILE_TAB_PATHS } from '@/config/navigation';
import { cn } from '@/lib/utils';
import { ProfileLanguageSync } from '@/i18n/ProfileLanguageSync';

// Native shell behaviour (CAPACITOR-PLAN.md → Phase 3). Both are inert on the
// web: the hook registers nothing off Android, and the keyboard store is always
// "closed" in a browser.
import { useHardwareBackButton } from '@/platform/shell/backButton';
import { useDeepLinks } from '@/platform/shell/deepLinks';
import { usePushDelivery } from '@/hooks/usePushDelivery';
import { useKeyboardOpen } from '@/platform/shell/keyboard';

// Onboarding system
import { OnboardingProvider } from '@/onboarding/store/onboarding.store';
import { OnboardingGuard } from '@/onboarding/OnboardingGuard';
import { OnboardingRouter } from '@/onboarding/OnboardingRouter';
import { OnboardingErrorBoundary } from '@/onboarding/OnboardingErrorBoundary';

// Biometric app lock (Phase 5). A no-op on the web and whenever the user has
// not turned it on — see src/lib/biometricUnlock.ts.
import { BiometricAppLock } from '@/components/auth/BiometricAppLock';

// Vendor connections (real API — polls for the pending-action badge)
import { VendorConnectionsProvider } from '@/store/vendorConnections.store';

// Shipments (real API — polls for the "needs attention" nav badge)
import { ShipmentsProvider } from '@/store/shipments.store';

// Agents (real API — roster + pending-invite count, shared with the Shipments assign-agent dropdown)
import { AgentsRosterProvider } from '@/store/agents.store';

// Notifications (real API — unread-count badge poller)
import { NotificationsProvider } from '@/store/notifications.store';

// Magazin (real API — business name + logo shown in the app chrome)
import { MagazinProvider } from '@/store/magazin.store';
import { StockRequestsProvider } from '@/store/stockRequests.store';

// ─── Shared content-frame width ──────────────────────────────────────────────
// The header and the main content share one centered column so their edges line
// up on every viewport and content never stretches unusably wide on large
// monitors. Keep these two class strings in sync.
const CONTENT_FRAME = 'mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8';

// ─── Sidebar collapse context (preserved for Sidebar/Header compatibility) ────

interface UIContextType {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  /** True when the collapse is forced by the tablet band, not the user toggle. */
  autoCollapsed: boolean;
}

const UIContext = createContext<UIContextType>({
  sidebarCollapsed: false,
  toggleSidebar: () => { },
  autoCollapsed: false,
});

export const useUI = () => useContext(UIContext);

// ─── Legacy auth context shim ─────────────────────────────────────────────────
// Kept for backward compatibility; Sidebar/Header now source identity from
// useOnboarding() directly. No live consumers remain, but harmless to keep.

interface LegacyAuthContextType {
  user: { id: string; name: string; email: string; role: string; avatar?: string } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<boolean>;
  logout: () => void;
}

const LegacyAuthContext = createContext<LegacyAuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: async () => false,
  logout: () => { },
});

export const useAuth = () => useContext(LegacyAuthContext);

// ─── Stock-request deep link ──────────────────────────────────────────────────
// The backend deep-links stock-request notifications to `stock-requests/{id}`
// (see api-doc/agency/notifications.md), but the inbox lives as a tab under
// Inventory. Without this the `*` catch-all would swallow every one of those
// notifications to /dashboard with no error at all.

function StockRequestDeepLink() {
  const { requestId } = useParams<{ requestId: string }>();
  return <Navigate to={`/dashboard/inventory/requests?open=${requestId ?? ''}`} replace />;
}

// ─── Foreground push ──────────────────────────────────────────────────────────
// A component only because the hook needs to sit INSIDE NotificationsProvider
// (it refreshes the list) while DashboardShell itself renders that provider and
// so is outside it. Renders nothing (CAPACITOR-PLAN.md → P4.7).

function PushDeliveryBridge() {
  usePushDelivery();
  return null;
}

// ─── Dashboard shell ──────────────────────────────────────────────────────────

function DashboardShell() {
  const { sidebarCollapsed } = useUI();
  const isMobile = useIsMobile();
  const keyboardOpen = useKeyboardOpen();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  /**
   * Swipe left/right between the bottom bar's sections.
   *
   * Only from a section itself: swiping on a screen opened from "More" has no
   * obvious neighbour, and guessing one would move the user somewhere they
   * cannot see the way back from. Returning `false` there also lets the gesture
   * stay unconsumed, which is what a page's own tab swipe relies on.
   *
   * `navigate` (a push, not a replace) so the gesture and a tap on the same tab
   * leave identical history behind them.
   */
  const goSection = (delta: number): boolean => {
    const index = MOBILE_TAB_PATHS.indexOf(pathname as (typeof MOBILE_TAB_PATHS)[number]);
    if (index < 0) return false;
    const next = MOBILE_TAB_PATHS[index + delta];
    if (!next) return false;
    navigate(next);
    return true;
  };

  const sectionSwipe = useSwipeNavigation({
    enabled: isMobile,
    onNext: () => goSection(1),
    onPrevious: () => goSection(-1),
  });

  return (
    <ShipmentsProvider>
      <AgentsRosterProvider>
        <NotificationsProvider>
        <PushDeliveryBridge />
        <VendorConnectionsProvider>
        <MagazinProvider>
        <StockRequestsProvider>
          <div className="min-h-screen bg-background">
            {/* Keeps the scrolling column out from under the status bar's icons
                — `main`'s top padding only holds at scroll position 0. Renders
                as a zero-height nothing off a device. */}
            <StatusBarScrim />
            {!isMobile && <Sidebar />}
            <div
              className={cn(
                'transition-all duration-300 ease-in-out',
                isMobile ? 'ms-0' : sidebarCollapsed ? 'ms-20' : 'ms-64',
              )}
            >
              {!isMobile && <Header />}
              <main
                {...sectionSwipe}
                className={cn(
                  CONTENT_FRAME,
                  'py-6 lg:py-8',
                  // The shell draws edge to edge on a device, so the status bar
                  // sits *over* the top of this column (P3.3). Zero everywhere
                  // else, including every desktop browser.
                  isMobile && 'pt-[calc(1.5rem+env(safe-area-inset-top))]',
                  // Room for the tab bar, its safe-area inset and the FAB that
                  // pokes above the row — except while the keyboard is up, when
                  // the tab bar hides itself and this would be 6rem of dead
                  // space under the field being typed into (P3.2).
                  isMobile &&
                    (keyboardOpen ? 'pb-6' : 'pb-[calc(6rem+env(safe-area-inset-bottom))]'),
                )}
              >
                <Routes>
                  <Route index element={<Overview />} />
                  <Route path="shipments" element={<Shipments />} />
                  <Route path="inventory" element={<Navigate to="/dashboard/inventory/stock" replace />} />
                  <Route path="inventory/:tab" element={<Inventory />} />
                  {/* The stock-request inbox is a tab under Inventory; these two
                      keep the backend's notification deep-link resolving. */}
                  <Route path="stock-requests" element={<Navigate to="/dashboard/inventory/requests" replace />} />
                  <Route path="stock-requests/:requestId" element={<StockRequestDeepLink />} />
                  <Route path="tracking" element={<LiveTracking />} />
                  <Route path="media" element={<MediaLibrary />} />
                  {/* Legacy alias — earnings now live under Account → Payout. */}
                  <Route path="earnings" element={<Navigate to="/dashboard/account/payout" replace />} />
                  <Route path="transactions" element={<Transactions />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="tickets" element={<Tickets />} />
                  <Route path="agents" element={<Navigate to="/dashboard/agents/connections" replace />} />
                  {/* Legacy aliases — the roster/invites/requests tabs are now one Connections tab. */}
                  <Route path="agents/roster" element={<Navigate to="/dashboard/agents/connections" replace />} />
                  <Route path="agents/invites" element={<Navigate to="/dashboard/agents/browse" replace />} />
                  <Route path="agents/requests" element={<Navigate to="/dashboard/agents/connections" replace />} />
                  <Route path="agents/:tab" element={<Agents />} />
                  <Route path="cash" element={<Navigate to="/dashboard/cash/summary" replace />} />
                  <Route path="cash/:tab" element={<CashManagement />} />
                  <Route path="vendors" element={<Navigate to="/dashboard/vendors/connections" replace />} />
                  <Route path="vendors/:tab" element={<Vendors />} />
                  {/* Deep-link alias — plan-expiry notification buttons point at the literal `plans` route. */}
                  <Route path="plans" element={<Navigate to="/dashboard/account/billing" replace />} />
                  <Route path="account" element={<Navigate to="/dashboard/account/profile" replace />} />
                  <Route path="account/:tab" element={<Account />} />
                  {/* Deep-link alias — `storage.alert` notifications point at the literal `settings/storage` path. */}
                  <Route path="settings/storage" element={<Navigate to="/dashboard/media" replace />} />
                  <Route path="settings" element={<Navigate to="/dashboard/settings/policies" replace />} />
                  <Route path="settings/:tab" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </main>
            </div>
            {isMobile && <MobileTabBar />}
          </div>
        </StockRequestsProvider>
        </MagazinProvider>
        </VendorConnectionsProvider>
        </NotificationsProvider>
      </AgentsRosterProvider>
    </ShipmentsProvider>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

function AppContent() {
  const [manualCollapsed, setManualCollapsed] = useState(false);
  const reactNavigate = useNavigate();

  // Tablet band (768–1023px): force the sidebar to its icon rail so a fixed
  // 256px sidebar doesn't squeeze the content column. At ≥1024px the user's
  // manual toggle takes over again.
  const autoCollapsed = useIsBelowDesktop();
  const sidebarCollapsed = autoCollapsed || manualCollapsed;

  const toggleSidebar = useCallback(() => setManualCollapsed((p) => !p), []);

  // Android's hardware back button: close an open sheet, else go back, else
  // confirm before exiting. Must be inside the Router; a no-op everywhere but
  // Android (CAPACITOR-PLAN.md → P3.1).
  useHardwareBackButton();

  // Notification taps and App Links land on the screen they name, instead of
  // whichever one the app happened to be on. Must be inside the Router; a no-op
  // off native (CAPACITOR-PLAN.md → P4.2).
  useDeepLinks();

  // Standardized session-expiry handling: the API layer dispatches `auth:logout`
  // when a token refresh fails. Route the user to login from a single place.
  //
  // The event carries the CAUSE, and the cause is worth keeping. Three of the
  // codes that reach here are terminal in a way a user can act on and a generic
  // "please sign in" hides:
  //
  //   AUTH_PASSWORD_CHANGED     to somebody who did not change their password,
  //                             this is the first sign that somebody else did;
  //   AUTH_SESSION_CAP_REACHED  the 90-day sign-in ceiling — retrying is futile
  //                             by construction, so saying why stops the user
  //                             hunting for a fault that is not there;
  //   AUTH_ACCOUNT_SUSPENDED    the account, not the session, is what is refused.
  //
  // It rides router state rather than a store: it is read exactly once, by the
  // screen we are navigating to, and it must not survive a reload.
  useEffect(() => {
    const onLogout = (event: Event) => {
      const cause = (event as CustomEvent<{ code?: string } | undefined>).detail;
      reactNavigate('/login', {
        replace: true,
        state: cause?.code ? { signedOutBy: cause.code } : undefined,
      });
    };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [reactNavigate]);

  // Text direction is owned by the i18n layer now: `changeLanguage` calls
  // `applyDocumentDirection`, so `<html lang>`/`dir` follow the active language
  // on boot and on every switch. See i18n/index.ts.

  const legacyUser = {
    id: 'agency',
    name: 'Agency',
    email: '',
    role: 'agency',
  };

  return (
    <LegacyAuthContext.Provider
      value={{
        user: legacyUser,
        isAuthenticated: true,
        isLoading: false,
        login: async () => false,
        logout: () => reactNavigate('/login'),
      }}
    >
      <UIContext.Provider value={{ sidebarCollapsed, toggleSidebar, autoCollapsed }}>
        {/* Theme lives on <html> (see lib/theme.ts + StoreProvider) so the body
            and every Radix portal see it too — never on a wrapper in here. */}
        <>
          {/* Outside the routes on purpose: "you are offline" is as true on the
              sign-in screen as it is on the dashboard, and that is the screen
              where mistaking it for a rejected password costs the most. */}
          <OfflineBanner />
          <OnboardingErrorBoundary>
            <OnboardingProvider>
              {/* Applies the agency's saved language as soon as the session loads. */}
              <ProfileLanguageSync />
              {/* Covers the app after a stretch in the background when the user
                  has turned on biometric unlock. Inside the provider because it
                  needs to know whether anyone is signed in; renders nothing on
                  the web and nothing when the feature is off. */}
              <BiometricAppLock />
              <Routes>
                {/* Public auth routes — outside OnboardingGuard, because the
                    guard's answer to "no session" is to send people here. */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                {/* Onboarding — gated: must be authenticated, step > 0 */}
                <Route
                  path="/onboarding/*"
                  element={
                    <OnboardingGuard>
                      <OnboardingRouter />
                    </OnboardingGuard>
                  }
                />

                {/* Dashboard — gated: must be authenticated AND fully onboarded */}
                <Route
                  path="/dashboard/*"
                  element={
                    <OnboardingGuard requireComplete>
                      <DashboardShell />
                    </OnboardingGuard>
                  }
                />

                {/* Root redirect */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </OnboardingProvider>
          </OnboardingErrorBoundary>
          {/* The offsets are sonner's own defaults (24px desktop, 16px mobile)
              plus the status-bar inset, so a toast is never posted underneath
              the clock on a device drawing edge to edge. `env()` resolves to 0
              in every browser, which leaves the web build exactly as it was. */}
          <Toaster
            richColors
            position="top-right"
            offset={{
              top: 'calc(24px + env(safe-area-inset-top))',
              right: '24px',
              bottom: '24px',
              left: '24px',
            }}
            mobileOffset={{
              top: 'calc(16px + env(safe-area-inset-top))',
              right: '16px',
              bottom: '16px',
              left: '16px',
            }}
          />
        </>
      </UIContext.Provider>
    </LegacyAuthContext.Provider>
  );
}

export default function App() {
  return <AppContent />;
}
