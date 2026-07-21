import { createContext, useContext, useState, useCallback } from 'react';
import type {
  User, Order,
  Notification, AnalyticsMetrics, DateRange,
  Transaction, TransactionCategory, Ticket, TicketStatus, TicketPriority,
  StorageItem,
} from '@/types';
import {
  mockUsers,
  mockOrders, mockNotifications,
  mockAnalytics, mockSalesData, mockCategoryBreakdown,
  mockTransactions, mockTickets,
  mockStorageItems,
} from '@/data/mockData';

// Auth Store Context
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthStoreContext = createContext<AuthState | null>(null);

// UI Store Context
interface UIState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

const UIStoreContext = createContext<UIState | null>(null);

// Order Store Context
interface OrderState {
  orders: Order[];
  selectedOrders: string[];
  isLoading: boolean;
  filters: {
    status?: string[];
    dateRange?: DateRange;
    search?: string;
  };
  fetchOrders: () => Promise<void>;
  updateOrderStatus: (id: string, status: string) => Promise<void>;
  toggleOrderSelection: (id: string) => void;
  selectAllOrders: (ids: string[]) => void;
  clearSelection: () => void;
  setFilters: (filters: Partial<OrderState['filters']>) => void;
}

const OrderStoreContext = createContext<OrderState | null>(null);

// Notification Store Context
interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationStoreContext = createContext<NotificationState | null>(null);

// Analytics Store Context
interface AnalyticsState {
  metrics: AnalyticsMetrics;
  salesData: typeof mockSalesData;
  categoryBreakdown: typeof mockCategoryBreakdown;
  dateRange: DateRange;
  isLoading: boolean;
  fetchAnalytics: () => Promise<void>;
  setDateRange: (range: DateRange) => void;
}

const AnalyticsStoreContext = createContext<AnalyticsState | null>(null);

// Transaction Store Context
interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;
  fetchTransactions: (category?: TransactionCategory) => Promise<void>;
}

const TransactionStoreContext = createContext<TransactionState | null>(null);

// Ticket Store Context
interface TicketState {
  tickets: Ticket[];
  isLoading: boolean;
  fetchTickets: () => Promise<void>;
  createTicket: (input: Partial<Ticket>) => Promise<void>;
  updateTicketStatus: (id: string, status: TicketStatus) => Promise<void>;
  updateTicketPriority: (id: string, priority: TicketPriority) => Promise<void>;
  addNote: (id: string, content: string) => Promise<void>;
  closeTicket: (id: string) => Promise<void>;
}

const TicketStoreContext = createContext<TicketState | null>(null);

// Storage Store Context
interface StorageState {
  items: StorageItem[];
  selectedItems: string[];
  isLoading: boolean;
  fetchStorageItems: () => Promise<void>;
  toggleItemSelection: (id: string) => void;
  selectAllItems: (ids: string[]) => void;
  clearSelection: () => void;
  returnToVendor: (id: string) => Promise<void>;
}

const StorageStoreContext = createContext<StorageState | null>(null);

// Provider Component
export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Auth State
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setAuthLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const user = mockUsers.find(u => u.email === email);
    if (user && password === 'password') {
      setAuthUser(user);
      setAuthLoading(false);
      return true;
    }
    setAuthLoading(false);
    return false;
  }, []);

  const logout = useCallback(() => {
    setAuthUser(null);
  }, []);

  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  // Order State
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderFilters, setOrderFilters] = useState<OrderState['filters']>({});

  const fetchOrders = useCallback(async () => {
    setOrderLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setOrderLoading(false);
  }, []);

  const updateOrderStatus = useCallback(async (id: string, status: string) => {
    setOrderLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setOrders(prev => prev.map(o =>
      o.id === id ? { ...o, status: status as Order['status'] } : o
    ));
    setOrderLoading(false);
  }, []);

  const toggleOrderSelection = useCallback((id: string) => {
    setSelectedOrders(prev =>
      prev.includes(id) ? prev.filter(oid => oid !== id) : [...prev, id]
    );
  }, []);

  const selectAllOrders = useCallback((ids: string[]) => {
    setSelectedOrders(ids);
  }, []);

  const clearOrderSelection = useCallback(() => {
    setSelectedOrders([]);
  }, []);

  const setFilters = useCallback((filters: Partial<OrderState['filters']>) => {
    setOrderFilters(prev => ({ ...prev, ...filters }));
  }, []);

  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  const fetchNotifications = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, read: true } : n
    ));
  }, []);

  const markAllAsRead = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Analytics State
  const [analyticsMetrics] = useState<AnalyticsMetrics>(mockAnalytics);
  const [salesData] = useState<typeof mockSalesData>(mockSalesData);
  const [categoryBreakdown] = useState<typeof mockCategoryBreakdown>(mockCategoryBreakdown);
  const [analyticsDateRange, setAnalyticsDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date(),
    label: 'Last 7 days',
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setAnalyticsLoading(false);
  }, []);

  // Transaction State
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [transactionLoading, setTransactionLoading] = useState(false);

  const fetchTransactions = useCallback(async (category?: TransactionCategory) => {
    setTransactionLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setTransactions(category ? mockTransactions.filter(t => t.category === category) : mockTransactions);
    setTransactionLoading(false);
  }, []);

  // Ticket State
  const [tickets, setTickets] = useState<Ticket[]>(mockTickets);
  const [ticketLoading, setTicketLoading] = useState(false);

  const fetchTickets = useCallback(async () => {
    setTicketLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setTicketLoading(false);
  }, []);

  const createTicket = useCallback(async (input: Partial<Ticket>) => {
    setTicketLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    const now = new Date().toISOString();
    const newTicket: Ticket = {
      id: `tkt-${Date.now()}`,
      subject: input.subject ?? '',
      description: input.description ?? '',
      status: 'open',
      priority: input.priority ?? 'medium',
      type: input.type ?? 'GENERAL_SUPPORT',
      createdAt: now,
      updatedAt: now,
      notes: [],
    };
    setTickets(prev => [newTicket, ...prev]);
    setTicketLoading(false);
  }, []);

  const updateTicketStatus = useCallback(async (id: string, status: TicketStatus) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    setTickets(prev => prev.map(t =>
      t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t
    ));
  }, []);

  const updateTicketPriority = useCallback(async (id: string, priority: TicketPriority) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    setTickets(prev => prev.map(t =>
      t.id === id ? { ...t, priority, updatedAt: new Date().toISOString() } : t
    ));
  }, []);

  const addNote = useCallback(async (id: string, content: string) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    setTickets(prev => prev.map(t =>
      t.id === id
        ? {
          ...t,
          notes: [...t.notes, { id: `n-${Date.now()}`, content, author: 'You', createdAt: new Date().toISOString() }],
          updatedAt: new Date().toISOString(),
        }
        : t
    ));
  }, []);

  const closeTicket = useCallback(async (id: string) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    setTickets(prev => prev.map(t =>
      t.id === id ? { ...t, status: 'closed' as const, updatedAt: new Date().toISOString() } : t
    ));
  }, []);

  // Storage State
  const [storageItems, setStorageItems] = useState<StorageItem[]>(mockStorageItems);
  const [selectedStorageItems, setSelectedStorageItems] = useState<string[]>([]);
  const [storageLoading, setStorageLoading] = useState(false);

  const fetchStorageItems = useCallback(async () => {
    setStorageLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setStorageLoading(false);
  }, []);

  const toggleItemSelection = useCallback((id: string) => {
    setSelectedStorageItems(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  }, []);

  const selectAllItems = useCallback((ids: string[]) => {
    setSelectedStorageItems(ids);
  }, []);

  const clearStorageSelection = useCallback(() => {
    setSelectedStorageItems([]);
  }, []);

  const returnToVendor = useCallback(async (id: string) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    setStorageItems(prev => prev.filter(item => item.id !== id));
    setSelectedStorageItems(prev => prev.filter(sid => sid !== id));
  }, []);

  return (
    <AuthStoreContext.Provider value={{
      user: authUser,
      isAuthenticated: !!authUser,
      isLoading: authLoading,
      login,
      logout,
      setUser: setAuthUser
    }}>
      <UIStoreContext.Provider value={{
        sidebarCollapsed,
        theme,
        toggleSidebar,
        setTheme,
      }}>
        <OrderStoreContext.Provider value={{
          orders,
          selectedOrders,
          isLoading: orderLoading,
          filters: orderFilters,
          fetchOrders,
          updateOrderStatus,
          toggleOrderSelection,
          selectAllOrders,
          clearSelection: clearOrderSelection,
          setFilters
        }}>
          <NotificationStoreContext.Provider value={{
            notifications,
            unreadCount,
            fetchNotifications,
            markAsRead,
            markAllAsRead
          }}>
            <AnalyticsStoreContext.Provider value={{
              metrics: analyticsMetrics,
              salesData,
              categoryBreakdown,
              dateRange: analyticsDateRange,
              isLoading: analyticsLoading,
              fetchAnalytics,
              setDateRange: setAnalyticsDateRange
            }}>
              <TransactionStoreContext.Provider value={{
                transactions,
                isLoading: transactionLoading,
                fetchTransactions,
              }}>
                <TicketStoreContext.Provider value={{
                  tickets,
                  isLoading: ticketLoading,
                  fetchTickets,
                  createTicket,
                  updateTicketStatus,
                  updateTicketPriority,
                  addNote,
                  closeTicket,
                }}>
                  <StorageStoreContext.Provider value={{
                    items: storageItems,
                    selectedItems: selectedStorageItems,
                    isLoading: storageLoading,
                    fetchStorageItems,
                    toggleItemSelection,
                    selectAllItems,
                    clearSelection: clearStorageSelection,
                    returnToVendor,
                  }}>
                    {children}
                  </StorageStoreContext.Provider>
                </TicketStoreContext.Provider>
              </TransactionStoreContext.Provider>
            </AnalyticsStoreContext.Provider>
          </NotificationStoreContext.Provider>
        </OrderStoreContext.Provider>
      </UIStoreContext.Provider>
    </AuthStoreContext.Provider>
  );
}

// Hooks
export function useAuthStore() {
  const context = useContext(AuthStoreContext);
  if (!context) throw new Error('useAuthStore must be used within StoreProvider');
  return context;
}

export function useUIStore() {
  const context = useContext(UIStoreContext);
  if (!context) throw new Error('useUIStore must be used within StoreProvider');
  return context;
}

export function useOrderStore() {
  const context = useContext(OrderStoreContext);
  if (!context) throw new Error('useOrderStore must be used within StoreProvider');
  return context;
}

export function useNotificationStore() {
  const context = useContext(NotificationStoreContext);
  if (!context) throw new Error('useNotificationStore must be used within StoreProvider');
  return context;
}

export function useAnalyticsStore() {
  const context = useContext(AnalyticsStoreContext);
  if (!context) throw new Error('useAnalyticsStore must be used within StoreProvider');
  return context;
}

export function useTransactionStore() {
  const context = useContext(TransactionStoreContext);
  if (!context) throw new Error('useTransactionStore must be used within StoreProvider');
  return context;
}

export function useTicketStore() {
  const context = useContext(TicketStoreContext);
  if (!context) throw new Error('useTicketStore must be used within StoreProvider');
  return context;
}

export function useStorageStore() {
  const context = useContext(StorageStoreContext);
  if (!context) throw new Error('useStorageStore must be used within StoreProvider');
  return context;
}
