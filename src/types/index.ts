// User & Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'agency' | 'staff';
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

// Order Types (an "order" here is a delivery assigned to this agency)
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
  type: 'delivery' | 'payout' | 'ticket' | 'system' | 'alert';
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

// Transaction Types (payouts, earnings, platform credits)
export type TransactionCategory = 'plan' | 'credit' | 'earning' | 'payout';
export type TransactionStatus = 'pending' | 'paid' | 'failed' | 'reversed' | 'completed';

export interface Transaction {
  id: string;
  category: TransactionCategory;
  status: TransactionStatus;
  direction: 'in' | 'out';
  amount: number;
  currency: string;
  description: string;
  createdAt: string;
}

// Ticket Types (support tickets)
export type TicketStatus = 'open' | 'in_progress' | 'waiting_on_admin' | 'waiting_on_agency' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketType =
  | 'GENERAL_SUPPORT'
  | 'ACCOUNT_ACCESS'
  | 'PROFILE_UPDATE'
  | 'PAYOUT_REQUEST'
  | 'PAYOUT_DELAY'
  | 'PAYOUT_DISPUTE'
  | 'DELIVERY_DELAY'
  | 'DELIVERY_CONFIRMATION'
  | 'POLICY_QUESTION'
  | 'TECHNICAL_ISSUE'
  | 'OTHER';

export interface TicketNote {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  type: TicketType;
  createdAt: string;
  updatedAt: string;
  notes: TicketNote[];
}

// Agent Types (independent delivery agents affiliated with this agency)
export type AgentStatus = 'active' | 'inactive' | 'suspended';
export type AgentVehicle = 'motorbike' | 'car' | 'van' | 'bicycle' | 'on_foot';

export interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  zone: string;
  vehicle: AgentVehicle;
  status: AgentStatus;
  deliveriesCompleted: number;
  rating: number;
  joinedAt: string;
}

export type AgentRequestStatus = 'pending' | 'approved' | 'declined';

export interface AgentRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  zone: string;
  vehicle: AgentVehicle;
  experienceYears: number;
  message?: string;
  status: AgentRequestStatus;
  requestedAt: string;
}

// Storage Types (multi-vendor warehouse inventory held by this agency)
export type StorageStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'reserved';

export interface StorageItem {
  id: string;
  sku: string;
  productName: string;
  image?: string;
  vendor: string;
  category: string;
  quantity: number;
  reorderLevel: number;
  unit: string;
  location: string;
  unitValue: number;
  status: StorageStatus;
  receivedAt: string;
  updatedAt: string;
}
