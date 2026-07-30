import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';

// Dashboard pages
import { Overview } from '@/pages/Overview';
import { Shipments } from '@/pages/Shipments';
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

// Layout
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { useIsMobile, useIsBelowDesktop } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { applyDocumentDirection } from '@/lib/direction';

// Onboarding system
import { OnboardingProvider } from '@/onboarding/store/onboarding.store';
import { OnboardingGuard } from '@/onboarding/OnboardingGuard';
import { OnboardingRouter } from '@/onboarding/OnboardingRouter';
import { OnboardingErrorBoundary } from '@/onboarding/OnboardingErrorBoundary';

// UIStore (kept for sidebar + theme)
import { useUIStore } from '@/store';

// Vendor connections (real API — polls for the pending-action badge)
import { VendorConnectionsProvider } from '@/store/vendorConnections.store';

// Shipments (real API — polls for the "needs attention" nav badge)
import { ShipmentsProvider } from '@/store/shipments.store';

// Agents (real API — roster + pending-invite count, shared with the Shipments assign-agent dropdown)
import { AgentsRosterProvider } from '@/store/agents.store';

// Notifications (real API — unread-count badge poller)
import { NotificationsProvider } from '@/store/notifications.store';

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

// ─── Dashboard shell ──────────────────────────────────────────────────────────

function DashboardShell() {
  const { sidebarCollapsed } = useUI();
  const isMobile = useIsMobile();

  return (
    <ShipmentsProvider>
      <AgentsRosterProvider>
        <NotificationsProvider>
        <VendorConnectionsProvider>
          <div className="min-h-screen bg-background">
            {!isMobile && <Sidebar />}
            <div
              className={cn(
                'transition-all duration-300 ease-in-out',
                isMobile ? 'ms-0' : sidebarCollapsed ? 'ms-20' : 'ms-64',
              )}
            >
              {!isMobile && <Header />}
              <main
                className={cn(
                  CONTENT_FRAME,
                  'py-6 lg:py-8',
                  isMobile && 'pb-[calc(6rem+env(safe-area-inset-bottom))]',
                )}
              >
                <Routes>
                  <Route index element={<Overview />} />
                  <Route path="shipments" element={<Shipments />} />
                  <Route path="tracking" element={<LiveTracking />} />
                  <Route path="media" element={<MediaLibrary />} />
                  {/* Legacy alias — earnings now live under Account → Payout. */}
                  <Route path="earnings" element={<Navigate to="/dashboard/account/payout" replace />} />
                  <Route path="transactions" element={<Transactions />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="tickets" element={<Tickets />} />
                  <Route path="agents" element={<Navigate to="/dashboard/agents/roster" replace />} />
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
        </VendorConnectionsProvider>
        </NotificationsProvider>
      </AgentsRosterProvider>
    </ShipmentsProvider>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

function AppContent() {
  const [manualCollapsed, setManualCollapsed] = useState(false);
  const { theme } = useUIStore();
  const reactNavigate = useNavigate();

  // Tablet band (768–1023px): force the sidebar to its icon rail so a fixed
  // 256px sidebar doesn't squeeze the content column. At ≥1024px the user's
  // manual toggle takes over again.
  const autoCollapsed = useIsBelowDesktop();
  const sidebarCollapsed = autoCollapsed || manualCollapsed;

  const toggleSidebar = useCallback(() => setManualCollapsed((p) => !p), []);

  // Standardized session-expiry handling: the API layer dispatches `auth:logout`
  // when a token refresh fails. Route the user to login from a single place.
  useEffect(() => {
    const onLogout = () => reactNavigate('/login');
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [reactNavigate]);

  // i18n direction seam: mirror the whole shell for RTL languages (Arabic).
  // A language switcher re-mirrors by calling applyDocumentDirection(lang).
  useEffect(() => {
    applyDocumentDirection(document.documentElement.lang || 'en');
  }, []);

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
        <div className={theme === 'dark' ? 'dark' : ''}>
          <OnboardingErrorBoundary>
            <OnboardingProvider>
              <Routes>
                {/* Login — placeholder, auth happens on example.com */}
                <Route
                  path="/login"
                  element={
                    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
                      <div className="text-center space-y-4 max-w-sm">
                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                          <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <path d="M16 10a4 4 0 0 1-8 0" />
                          </svg>
                        </div>
                        <h1 className="text-2xl font-bold">Jovi Mall Agency</h1>
                        <p className="text-muted-foreground text-sm">
                          Please log in via the main site to access your agency dashboard.
                        </p>
                        <a
                          href="http://localhost:3000/login"
                          className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors w-full"
                        >
                          Go to login
                        </a>
                      </div>
                    </div>
                  }
                />

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
          <Toaster richColors position="top-right" />
        </div>
      </UIContext.Provider>
    </LegacyAuthContext.Provider>
  );
}

export default function App() {
  return <AppContent />;
}
