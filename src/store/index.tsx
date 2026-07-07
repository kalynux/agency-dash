import { createContext, useContext, useState, useCallback } from 'react';
import type { 
  User, Store, Product, Order, Vendor, 
  Notification, AnalyticsMetrics, DateRange, 
  MediaFile, MediaFolder, MediaSortField 
} from '@/types';
import { 
  mockUsers, mockStores, mockProducts, 
  mockOrders, mockVendors, mockNotifications,
  mockAnalytics, mockSalesData, mockCategoryBreakdown,
  mockMediaFiles, mockMediaFolders
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
  settingsTab: string;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setSettingsTab: (tab: string) => void;
}

const UIStoreContext = createContext<UIState | null>(null);

// Store Store Context
interface StoreState {
  stores: Store[];
  currentStore: Store | null;
  setCurrentStore: (store: Store | null) => void;
  fetchStores: () => Promise<void>;
}

const StoreStoreContext = createContext<StoreState | null>(null);

// Product Store Context
interface ProductState {
  products: Product[];
  selectedProducts: string[];
  isLoading: boolean;
  fetchProducts: () => Promise<void>;
  createProduct: (product: Partial<Product>) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  toggleProductSelection: (id: string) => void;
  selectAllProducts: (ids: string[]) => void;
  clearSelection: () => void;
}

const ProductStoreContext = createContext<ProductState | null>(null);

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

// Vendor Store Context
interface VendorState {
  vendors: Vendor[];
  isLoading: boolean;
  fetchVendors: () => Promise<void>;
  approveVendor: (id: string) => Promise<void>;
  suspendVendor: (id: string) => Promise<void>;
  updateCommission: (id: string, rate: number) => Promise<void>;
}

const VendorStoreContext = createContext<VendorState | null>(null);

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

// Media Store Context
interface MediaState {
  files: MediaFile[];
  folders: MediaFolder[];
  selectedFiles: string[];
  isLoading: boolean;
  uploadProgress: Record<string, number>;
  currentFolderId?: string;
  viewMode: 'grid' | 'list';
  sortBy: MediaSortField;
  sortOrder: 'asc' | 'desc';
  filterType?: 'image' | 'video' | 'document' | 'audio';
  searchQuery: string;
  fetchFiles: () => Promise<void>;
  fetchFolders: () => Promise<void>;
  uploadFile: (file: File, metadata?: Partial<MediaFile['metadata']>) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  deleteMultipleFiles: (ids: string[]) => Promise<void>;
  toggleFileSelection: (id: string) => void;
  selectAllFiles: (ids: string[]) => void;
  clearSelection: () => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setSortBy: (field: MediaSortField) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  setFilterType: (type?: 'image' | 'video' | 'document' | 'audio') => void;
  setSearchQuery: (query: string) => void;
  setCurrentFolder: (folderId?: string) => void;
  createFolder: (name: string, parentId?: string) => Promise<void>;
  updateFileMetadata: (id: string, metadata: Partial<MediaFile['metadata']>) => Promise<void>;
}

const MediaStoreContext = createContext<MediaState | null>(null);

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
  const [settingsTab, setSettingsTab] = useState('profile');

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  // Store State
  const [stores] = useState<Store[]>(mockStores);
  const [currentStore, setCurrentStore] = useState<Store | null>(mockStores[0]);

  const fetchStores = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
  }, []);

  // Product State
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productLoading, setProductLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    setProductLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setProductLoading(false);
  }, []);

  const createProduct = useCallback(async (product: Partial<Product>) => {
    setProductLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    const newProduct: Product = {
      ...mockProducts[0],
      ...(product as Product),
      id: String(Date.now()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProducts(prev => [newProduct, ...prev]);
    setProductLoading(false);
  }, []);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    setProductLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setProducts(prev => prev.map(p => 
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    ));
    setProductLoading(false);
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    setProductLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setProducts(prev => prev.filter(p => p.id !== id));
    setSelectedProducts(prev => prev.filter(pid => pid !== id));
    setProductLoading(false);
  }, []);

  const toggleProductSelection = useCallback((id: string) => {
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  }, []);

  const selectAllProducts = useCallback((ids: string[]) => {
    setSelectedProducts(ids);
  }, []);

  const clearProductSelection = useCallback(() => {
    setSelectedProducts([]);
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

  // Vendor State
  const [vendors, setVendors] = useState<Vendor[]>(mockVendors);
  const [vendorLoading, setVendorLoading] = useState(false);

  const fetchVendors = useCallback(async () => {
    setVendorLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setVendorLoading(false);
  }, []);

  const approveVendor = useCallback(async (id: string) => {
    setVendorLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setVendors(prev => prev.map(v => 
      v.id === id ? { ...v, status: 'active' as const } : v
    ));
    setVendorLoading(false);
  }, []);

  const suspendVendor = useCallback(async (id: string) => {
    setVendorLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setVendors(prev => prev.map(v => 
      v.id === id ? { ...v, status: 'suspended' as const } : v
    ));
    setVendorLoading(false);
  }, []);

  const updateCommission = useCallback(async (id: string, rate: number) => {
    setVendorLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setVendors(prev => prev.map(v => 
      v.id === id ? { ...v, commissionRate: rate } : v
    ));
    setVendorLoading(false);
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

  // Media State
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>(mockMediaFiles);
  const [mediaFolders, setMediaFolders] = useState<MediaFolder[]>(mockMediaFolders);
  const [selectedMediaFiles, setSelectedMediaFiles] = useState<string[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [currentMediaFolder, setCurrentMediaFolder] = useState<string | undefined>(undefined);
  const [mediaViewMode, setMediaViewMode] = useState<'grid' | 'list'>('grid');
  const [mediaSortBy, setMediaSortBy] = useState<MediaSortField>('date');
  const [mediaSortOrder, setMediaSortOrder] = useState<'asc' | 'desc'>('desc');
  const [mediaFilterType, setMediaFilterType] = useState<'image' | 'video' | 'document' | 'audio' | undefined>(undefined);
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');

  const fetchMediaFiles = useCallback(async () => {
    setMediaLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setMediaLoading(false);
  }, []);

  const fetchMediaFolders = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
  }, []);

  const uploadMediaFile = useCallback(async (file: File, metadata?: Partial<MediaFile['metadata']>) => {
    const fileId = String(Date.now());
    setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));
    
    // Simulate upload progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      setUploadProgress(prev => ({ ...prev, [fileId]: i }));
    }
    
    const newFile: MediaFile = {
      id: fileId,
      name: file.name,
      url: URL.createObjectURL(file),
      thumbnailUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document',
      mimeType: file.type,
      size: file.size,
      metadata: {
        alt: metadata?.alt || '',
        caption: metadata?.caption || '',
        title: metadata?.title || file.name,
        description: metadata?.description || '',
      },
      tags: [],
      folderId: currentMediaFolder,
      uploadedBy: authUser?.id || 'unknown',
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
      usedIn: [],
    };
    
    setMediaFiles(prev => [newFile, ...prev]);
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
  }, [currentMediaFolder, authUser]);

  const deleteMediaFile = useCallback(async (id: string) => {
    setMediaLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setMediaFiles(prev => prev.filter(f => f.id !== id));
    setSelectedMediaFiles(prev => prev.filter(fid => fid !== id));
    setMediaLoading(false);
  }, []);

  const deleteMultipleMediaFiles = useCallback(async (ids: string[]) => {
    setMediaLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setMediaFiles(prev => prev.filter(f => !ids.includes(f.id)));
    setSelectedMediaFiles(prev => prev.filter(fid => !ids.includes(fid)));
    setMediaLoading(false);
  }, []);

  const toggleMediaFileSelection = useCallback((id: string) => {
    setSelectedMediaFiles(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  }, []);

  const selectAllMediaFiles = useCallback((ids: string[]) => {
    setSelectedMediaFiles(ids);
  }, []);

  const clearMediaSelection = useCallback(() => {
    setSelectedMediaFiles([]);
  }, []);

  const createMediaFolder = useCallback(async (name: string, parentId?: string) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const newFolder: MediaFolder = {
      id: String(Date.now()),
      name,
      parentId,
      createdAt: new Date().toISOString(),
    };
    setMediaFolders(prev => [...prev, newFolder]);
  }, []);

  const updateFileMetadata = useCallback(async (id: string, metadata: Partial<MediaFile['metadata']>) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    setMediaFiles(prev => prev.map(f => 
      f.id === id ? { ...f, metadata: { ...f.metadata, ...metadata }, updatedAt: new Date().toISOString() } : f
    ));
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
        settingsTab,
        toggleSidebar, 
        setTheme,
        setSettingsTab
      }}>
        <StoreStoreContext.Provider value={{ 
          stores, 
          currentStore, 
          setCurrentStore, 
          fetchStores 
        }}>
          <ProductStoreContext.Provider value={{ 
            products, 
            selectedProducts, 
            isLoading: productLoading, 
            fetchProducts, 
            createProduct, 
            updateProduct, 
            deleteProduct, 
            toggleProductSelection, 
            selectAllProducts, 
            clearSelection: clearProductSelection 
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
              <VendorStoreContext.Provider value={{ 
                vendors, 
                isLoading: vendorLoading, 
                fetchVendors, 
                approveVendor, 
                suspendVendor, 
                updateCommission 
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
                    <MediaStoreContext.Provider value={{
                      files: mediaFiles,
                      folders: mediaFolders,
                      selectedFiles: selectedMediaFiles,
                      isLoading: mediaLoading,
                      uploadProgress,
                      currentFolderId: currentMediaFolder,
                      viewMode: mediaViewMode,
                      sortBy: mediaSortBy,
                      sortOrder: mediaSortOrder,
                      filterType: mediaFilterType,
                      searchQuery: mediaSearchQuery,
                      fetchFiles: fetchMediaFiles,
                      fetchFolders: fetchMediaFolders,
                      uploadFile: uploadMediaFile,
                      deleteFile: deleteMediaFile,
                      deleteMultipleFiles: deleteMultipleMediaFiles,
                      toggleFileSelection: toggleMediaFileSelection,
                      selectAllFiles: selectAllMediaFiles,
                      clearSelection: clearMediaSelection,
                      setViewMode: setMediaViewMode,
                      setSortBy: setMediaSortBy,
                      setSortOrder: setMediaSortOrder,
                      setFilterType: setMediaFilterType,
                      setSearchQuery: setMediaSearchQuery,
                      setCurrentFolder: setCurrentMediaFolder,
                      createFolder: createMediaFolder,
                      updateFileMetadata,
                    }}>
                      {children}
                    </MediaStoreContext.Provider>
                  </AnalyticsStoreContext.Provider>
                </NotificationStoreContext.Provider>
              </VendorStoreContext.Provider>
            </OrderStoreContext.Provider>
          </ProductStoreContext.Provider>
        </StoreStoreContext.Provider>
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

export function useStoreStore() {
  const context = useContext(StoreStoreContext);
  if (!context) throw new Error('useStoreStore must be used within StoreProvider');
  return context;
}

export function useProductStore() {
  const context = useContext(ProductStoreContext);
  if (!context) throw new Error('useProductStore must be used within StoreProvider');
  return context;
}

export function useOrderStore() {
  const context = useContext(OrderStoreContext);
  if (!context) throw new Error('useOrderStore must be used within StoreProvider');
  return context;
}

export function useVendorStore() {
  const context = useContext(VendorStoreContext);
  if (!context) throw new Error('useVendorStore must be used within StoreProvider');
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

export function useMediaStore() {
  const context = useContext(MediaStoreContext);
  if (!context) throw new Error('useMediaStore must be used within StoreProvider');
  return context;
}
