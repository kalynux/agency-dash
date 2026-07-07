// User & Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'store_owner' | 'staff';
  storeIds: string[];
  permissions: Permission[];
  telegramConnected?: boolean;
  whatsappConnected?: boolean;
}

export interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Store Types
export interface Store {
  id: string;
  name: string;
  domain: string;
  logo?: string;
  status: 'active' | 'inactive' | 'pending';
  plan: 'basic' | 'professional' | 'enterprise';
  vendorId: string;
  createdAt: string;
  settings: StoreSettings;
}

export interface StoreSettings {
  currency: string;
  timezone: string;
  language: string;
}

// Product Types - Legacy (for backward compatibility)
export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  costPerItem?: number;
  images: string[];
  status: 'active' | 'draft' | 'archived';
  inventory: Inventory;
  variants: ProductVariant[];
  vendor: string;
  category: string;
  tags: string[];
  seo: SEO;
  createdAt: string;
  updatedAt: string;
  productType?: ProductType;
  weight?: number;
  weightUnit?: 'kg' | 'g' | 'lb' | 'oz';
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  dimensionUnit?: 'cm' | 'm' | 'in' | 'ft';
  requiresShipping?: boolean;
  digitalAssets?: DigitalAsset[];
  downloadLimit?: number;
  downloadExpiryDays?: number;
  previewEnabled?: boolean;
  duration?: number;
  durationUnit?: 'minute' | 'hour' | 'day';
  locationType?: 'virtual' | 'physical' | 'both';
  bufferTimeBefore?: number;
  bufferTimeAfter?: number;
  variantStrategy?: 'single' | 'variant';
  bookingSettings?: ServiceBookingSettings;
  availability?: ServiceAvailability;
  staffIds?: string[];
}

export interface ProductVariant {
  id: string;
  title: string;
  sku: string;
  price: number;
  inventory: number;
  options: { name: string; value: string }[];
}

export interface Inventory {
  quantity: number;
  tracked: boolean;
  lowStockThreshold: number;
}

export interface SEO {
  title: string;
  description: string;
}

export type ProductType = 'physical' | 'digital' | 'service';

export interface DigitalAsset {
  id: string;
  fileId: string;
  name: string;
  size: number;
  mimeType: string;
  downloadCount: number;
}

// Order Types
export interface Order {
  id: string;
  orderNumber: string;
  customer: Customer;
  items: OrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  tags: string[];
  timeline: OrderTimelineEvent[];
  riskLevel: 'low' | 'medium' | 'high';
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';
export type FulfillmentStatus = 'unfulfilled' | 'partial' | 'fulfilled' | 'restocked';

export interface OrderItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  total: number;
  image?: string;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  addresses: Address[];
  defaultAddress?: Address;
  orderCount: number;
  totalSpent: number;
}

export interface Address {
  id: string;
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone?: string;
}

export interface OrderTimelineEvent {
  id: string;
  type: 'order_placed' | 'payment_processed' | 'fulfillment_started' | 'shipped' | 'delivered' | 'note_added' | 'refund_processed';
  message: string;
  createdAt: string;
  actor: string;
}

// Vendor Types
export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone?: string;
  logo?: string;
  status: 'active' | 'inactive' | 'pending_approval' | 'suspended';
  commissionRate: number;
  stores: Store[];
  performance: VendorPerformance;
  payoutInfo: PayoutInfo;
  createdAt: string;
  documents: VendorDocument[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface VendorPerformance {
  totalSales: number;
  totalOrders: number;
  averageRating: number;
  responseTime: number;
  fulfillmentRate: number;
  returnRate: number;
}

export interface PayoutInfo {
  method: 'bank_transfer' | 'paypal' | 'stripe';
  accountDetails: string;
  lastPayout?: string;
  pendingAmount: number;
}

export interface VendorDocument {
  id: string;
  type: 'identity' | 'business_license' | 'tax_document' | 'bank_statement';
  status: 'pending' | 'approved' | 'rejected';
  url: string;
  uploadedAt: string;
}

// Analytics Types
export interface AnalyticsMetrics {
  totalSales: MetricWithChange;
  totalOrders: MetricWithChange;
  conversionRate: MetricWithChange;
  averageOrderValue: MetricWithChange;
}

export interface MetricWithChange {
  value: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
}

export interface SalesDataPoint {
  date: string;
  sales: number;
  orders: number;
}

export interface CategoryBreakdown {
  category: string;
  sales: number;
  percentage: number;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'order' | 'product' | 'customer' | 'system' | 'alert';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

// UI Types
export interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

export interface FilterState {
  status?: string[];
  dateRange?: DateRange;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Media File Types
export interface MediaFile {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  type: 'image' | 'video' | 'document' | 'audio';
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  metadata: MediaMetadata;
  tags: string[];
  folderId?: string;
  uploadedBy: string;
  uploadedAt: string;
  updatedAt: string;
  usageCount: number;
  usedIn: UsedInReference[];
}

export interface MediaMetadata {
  alt?: string;
  caption?: string;
  title?: string;
  description?: string;
}

export interface UsedInReference {
  type: 'product' | 'category' | 'vendor' | 'page' | 'blog';
  id: string;
  name: string;
}

export interface MediaFolder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: string;
}

export type MediaSortField = 'name' | 'date' | 'size' | 'usage';
export type MediaViewMode = 'grid' | 'list';

// Extended Product Types for Product Upload Flow
export interface ServiceBookingSettings {
  minAdvanceBooking: number;
  maxAdvanceBooking: number;
  minAdvanceUnit: 'minute' | 'hour' | 'day';
  maxAdvanceUnit: 'minute' | 'hour' | 'day';
  allowRescheduling: boolean;
  cancellationPolicy: 'anytime' | '24h' | '48h' | '72h' | 'custom';
  customCancellationHours?: number;
}

export interface ServiceAvailability {
  timezone: string;
  schedule: WeeklySchedule;
  exceptions: DateException[];
}

export interface WeeklySchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  enabled: boolean;
  slots: TimeSlot[];
}

export interface TimeSlot {
  start: string;
  end: string;
}

export interface DateException {
  date: string;
  type: 'unavailable' | 'special';
  slots?: TimeSlot[];
  reason?: string;
}

// Product Upload Flow Types
export type ProductUploadStep =
  | 'type-selection'
  | 'basic-info'
  | 'media'
  | 'pricing'
  | 'variants'
  | 'digital-assets'
  | 'service-config'
  | 'shipping'
  | 'seo'
  | 'review';

export interface ProductUploadState {
  step: ProductUploadStep;
  productType: ProductType | null;
  data: Partial<Product>;
  validationErrors: Record<string, string[]>;
  isSubmitting: boolean;
  isDirty: boolean;
}
