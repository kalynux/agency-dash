import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { createContext, useContext, useCallback, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';

// Dashboard pages
import { Overview } from '@/pages/Overview';
import { Orders } from '@/pages/Orders';
import { Products } from '@/pages/Products';
import { Customers } from '@/pages/Customers';
import { Analytics } from '@/pages/Analytics';
import { Vendors } from '@/pages/Vendors';
import { Notifications } from '@/pages/Notifications';
import { Settings } from '@/pages/Settings';
import { MediaGallery } from '@/pages/MediaGallery';
import { ProductUpload } from '@/pages/ProductUpload';
import { Support } from '@/pages/Support';

// Layout
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

// Onboarding system
import { OnboardingProvider } from '@/onboarding/store/onboarding.store';
import { OnboardingGuard } from '@/onboarding/OnboardingGuard';
import { OnboardingRouter } from '@/onboarding/OnboardingRouter';
import { OnboardingErrorBoundary } from '@/onboarding/OnboardingErrorBoundary';

// UIStore (kept for sidebar + theme)
import { useUIStore } from '@/store';

// ─── Sidebar collapse context (preserved for Sidebar/Header compatibility) ────

interface UIContextType {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const UIContext = createContext<UIContextType>({
  sidebarCollapsed: false,
  toggleSidebar: () => { },
});

export const useUI = () => useContext(UIContext);

// ─── Legacy auth context shim ─────────────────────────────────────────────────
// Sidebar and Header reference useAuth() from @/App. This shim re-exports a
// compatible context so those components compile without changes.

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

// ─── Legacy router context shim ───────────────────────────────────────────────
// Header/Sidebar use useRouter().navigate(route). Map legacy route strings to
// real URL paths.

type LegacyRoute =
  | 'overview' | 'orders' | 'products' | 'product-upload' | 'customers'
  | 'analytics' | 'vendors' | 'notifications' | 'settings' | 'media' | 'support' | 'login';

const LEGACY_ROUTE_MAP: Record<LegacyRoute, string> = {
  overview: '/dashboard',
  orders: '/dashboard/orders',
  products: '/dashboard/products',
  'product-upload': '/dashboard/product-upload',
  customers: '/dashboard/customers',
  analytics: '/dashboard/analytics',
  vendors: '/dashboard/vendors',
  notifications: '/dashboard/notifications',
  settings: '/dashboard/settings',
  media: '/dashboard/media',
  support: '/dashboard/support',
  login: '/login',
};

interface LegacyRouterContextType {
  route: LegacyRoute;
  navigate: (route: LegacyRoute) => void;
}

const LegacyRouterContext = createContext<LegacyRouterContextType>({
  route: 'overview',
  navigate: () => { },
});

export const useRouter = () => useContext(LegacyRouterContext);

// ─── Dashboard shell ──────────────────────────────────────────────────────────

function DashboardShell() {
  const { sidebarCollapsed } = useUI();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        className="transition-all duration-300 ease-in-out"
        style={{ marginLeft: sidebarCollapsed ? '80px' : '256px' }}
      >
        <Header />
        <main className="p-6">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="orders" element={<Orders />} />
            <Route path="products" element={<Products />} />
            <Route path="product-upload" element={<ProductUpload />} />
            <Route path="customers" element={<Customers />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="vendors" element={<Vendors />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
            <Route path="media" element={<MediaGallery />} />
            <Route path="support" element={<Support />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

function AppContent() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { theme } = useUIStore();
  const reactNavigate = useNavigate();

  const toggleSidebar = useCallback(() => setSidebarCollapsed((p) => !p), []);

  // Legacy router shim — maps old string routes to real URL navigation
  const legacyNavigate = useCallback(
    (route: LegacyRoute) => {
      reactNavigate(LEGACY_ROUTE_MAP[route] ?? '/dashboard');
    },
    [reactNavigate],
  );

  // Legacy auth shim — expose enough shape for Sidebar/Header (they only read
  // user.name, user.email, user.role, user.avatar). Real auth lives in
  // OnboardingProvider which Sidebar does not access directly.
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
      <LegacyRouterContext.Provider value={{ route: 'overview', navigate: legacyNavigate }}>
        <UIContext.Provider value={{ sidebarCollapsed, toggleSidebar }}>
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
      </LegacyRouterContext.Provider>
    </LegacyAuthContext.Provider>
  );
}

export default function App() {
  return <AppContent />;
}
