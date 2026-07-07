import type { 
  User, Store, Product, Order, Vendor, 
  AnalyticsMetrics, SalesDataPoint, CategoryBreakdown, 
  Notification, Customer, MediaFile, MediaFolder 
} from '@/types';

// Mock Users
export const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@marketplace.com',
    name: 'Admin User',
    avatar: 'https://i.pravatar.cc/150?u=admin',
    role: 'admin',
    storeIds: ['1', '2', '3'],
    permissions: [
      { resource: '*', actions: ['create', 'read', 'update', 'delete'] }
    ]
  },
  {
    id: '2',
    email: 'vendor@example.com',
    name: 'John Vendor',
    avatar: 'https://i.pravatar.cc/150?u=vendor',
    role: 'store_owner',
    storeIds: ['1'],
    permissions: [
      { resource: 'products', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'orders', actions: ['read', 'update'] },
      { resource: 'analytics', actions: ['read'] }
    ]
  },
  {
    id: '3',
    email: 'staff@example.com',
    name: 'Sarah Staff',
    avatar: 'https://i.pravatar.cc/150?u=staff',
    role: 'staff',
    storeIds: ['1'],
    permissions: [
      { resource: 'products', actions: ['read', 'update'] },
      { resource: 'orders', actions: ['read'] }
    ]
  }
];

// Mock Stores
export const mockStores: Store[] = [
  {
    id: '1',
    name: 'Tech Gadgets Pro',
    domain: 'techgadgets.marketplace.com',
    logo: 'https://placehold.co/100x100/6366f1/ffffff?text=TG',
    status: 'active',
    plan: 'professional',
    vendorId: '2',
    createdAt: '2024-01-15T00:00:00Z',
    settings: {
      currency: 'USD',
      timezone: 'America/New_York',
      language: 'en'
    }
  },
  {
    id: '2',
    name: 'Fashion Hub',
    domain: 'fashionhub.marketplace.com',
    logo: 'https://placehold.co/100x100/ec4899/ffffff?text=FH',
    status: 'active',
    plan: 'basic',
    vendorId: '3',
    createdAt: '2024-02-20T00:00:00Z',
    settings: {
      currency: 'USD',
      timezone: 'America/Los_Angeles',
      language: 'en'
    }
  },
  {
    id: '3',
    name: 'Home Essentials',
    domain: 'homeessentials.marketplace.com',
    logo: 'https://placehold.co/100x100/10b981/ffffff?text=HE',
    status: 'pending',
    plan: 'basic',
    vendorId: '4',
    createdAt: '2024-03-10T00:00:00Z',
    settings: {
      currency: 'USD',
      timezone: 'America/Chicago',
      language: 'en'
    }
  }
];

// Mock Products
export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Wireless Bluetooth Headphones',
    description: 'Premium noise-cancelling wireless headphones with 30-hour battery life.',
    sku: 'WBH-001',
    price: 149.99,
    compareAtPrice: 199.99,
    costPerItem: 75.00,
    images: [
      'https://placehold.co/400x400/6366f1/ffffff?text=Headphones',
      'https://placehold.co/400x400/8b5cf6/ffffff?text=Headphones+2'
    ],
    status: 'active',
    inventory: {
      quantity: 45,
      tracked: true,
      lowStockThreshold: 10
    },
    variants: [
      { id: 'v1', title: 'Black', sku: 'WBH-001-BLK', price: 149.99, inventory: 20, options: [{ name: 'Color', value: 'Black' }] },
      { id: 'v2', title: 'White', sku: 'WBH-001-WHT', price: 149.99, inventory: 15, options: [{ name: 'Color', value: 'White' }] },
      { id: 'v3', title: 'Blue', sku: 'WBH-001-BLU', price: 159.99, inventory: 10, options: [{ name: 'Color', value: 'Blue' }] }
    ],
    vendor: 'Tech Gadgets Pro',
    category: 'Electronics',
    tags: ['wireless', 'audio', 'headphones', 'bluetooth'],
    seo: {
      title: 'Premium Wireless Bluetooth Headphones',
      description: 'Experience crystal-clear audio with our premium wireless headphones.'
    },
    createdAt: '2024-01-20T00:00:00Z',
    updatedAt: '2024-03-15T00:00:00Z'
  },
  {
    id: '2',
    name: 'Smart Watch Pro',
    description: 'Advanced fitness tracking smartwatch with heart rate monitor and GPS.',
    sku: 'SWP-002',
    price: 299.99,
    compareAtPrice: 349.99,
    costPerItem: 150.00,
    images: [
      'https://placehold.co/400x400/10b981/ffffff?text=Smartwatch',
      'https://placehold.co/400x400/059669/ffffff?text=Smartwatch+2'
    ],
    status: 'active',
    inventory: {
      quantity: 32,
      tracked: true,
      lowStockThreshold: 5
    },
    variants: [
      { id: 'v4', title: 'Space Gray', sku: 'SWP-002-SG', price: 299.99, inventory: 15, options: [{ name: 'Color', value: 'Space Gray' }] },
      { id: 'v5', title: 'Silver', sku: 'SWP-002-SLV', price: 299.99, inventory: 12, options: [{ name: 'Color', value: 'Silver' }] },
      { id: 'v6', title: 'Gold', sku: 'SWP-002-GLD', price: 329.99, inventory: 5, options: [{ name: 'Color', value: 'Gold' }] }
    ],
    vendor: 'Tech Gadgets Pro',
    category: 'Electronics',
    tags: ['smartwatch', 'fitness', 'wearable', 'gps'],
    seo: {
      title: 'Smart Watch Pro - Advanced Fitness Tracker',
      description: 'Track your fitness goals with our advanced smartwatch.'
    },
    createdAt: '2024-02-05T00:00:00Z',
    updatedAt: '2024-03-10T00:00:00Z'
  },
  {
    id: '3',
    name: 'Leather Crossbody Bag',
    description: 'Genuine leather crossbody bag with adjustable strap and multiple compartments.',
    sku: 'LCB-003',
    price: 89.99,
    compareAtPrice: 119.99,
    costPerItem: 45.00,
    images: [
      'https://placehold.co/400x400/92400e/ffffff?text=Bag',
      'https://placehold.co/400x400/b45309/ffffff?text=Bag+2'
    ],
    status: 'active',
    inventory: {
      quantity: 18,
      tracked: true,
      lowStockThreshold: 8
    },
    variants: [
      { id: 'v7', title: 'Brown', sku: 'LCB-003-BRN', price: 89.99, inventory: 10, options: [{ name: 'Color', value: 'Brown' }] },
      { id: 'v8', title: 'Black', sku: 'LCB-003-BLK', price: 89.99, inventory: 8, options: [{ name: 'Color', value: 'Black' }] }
    ],
    vendor: 'Fashion Hub',
    category: 'Fashion',
    tags: ['leather', 'bag', 'accessories', 'fashion'],
    seo: {
      title: 'Genuine Leather Crossbody Bag',
      description: 'Stylish and functional leather crossbody bag.'
    },
    createdAt: '2024-02-15T00:00:00Z',
    updatedAt: '2024-03-05T00:00:00Z'
  },
  {
    id: '4',
    name: 'Ceramic Coffee Mug Set',
    description: 'Set of 4 handcrafted ceramic coffee mugs, microwave and dishwasher safe.',
    sku: 'CCM-004',
    price: 34.99,
    costPerItem: 15.00,
    images: [
      'https://placehold.co/400x400/f59e0b/ffffff?text=Mugs',
      'https://placehold.co/400x400/d97706/ffffff?text=Mugs+2'
    ],
    status: 'active',
    inventory: {
      quantity: 60,
      tracked: true,
      lowStockThreshold: 15
    },
    variants: [],
    vendor: 'Home Essentials',
    category: 'Home',
    tags: ['ceramic', 'mugs', 'kitchen', 'home'],
    seo: {
      title: 'Ceramic Coffee Mug Set of 4',
      description: 'Beautiful handcrafted ceramic coffee mugs.'
    },
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-12T00:00:00Z'
  },
  {
    id: '5',
    name: 'Portable Phone Charger',
    description: '20000mAh power bank with fast charging and dual USB ports.',
    sku: 'PPC-005',
    price: 49.99,
    compareAtPrice: 69.99,
    costPerItem: 22.00,
    images: [
      'https://placehold.co/400x400/3b82f6/ffffff?text=Charger'
    ],
    status: 'draft',
    inventory: {
      quantity: 100,
      tracked: true,
      lowStockThreshold: 20
    },
    variants: [
      { id: 'v9', title: 'Black', sku: 'PPC-005-BLK', price: 49.99, inventory: 60, options: [{ name: 'Color', value: 'Black' }] },
      { id: 'v10', title: 'White', sku: 'PPC-005-WHT', price: 49.99, inventory: 40, options: [{ name: 'Color', value: 'White' }] }
    ],
    vendor: 'Tech Gadgets Pro',
    category: 'Electronics',
    tags: ['powerbank', 'charger', 'accessories'],
    seo: {
      title: 'Portable Phone Charger 20000mAh',
      description: 'High-capacity power bank for all your devices.'
    },
    createdAt: '2024-03-08T00:00:00Z',
    updatedAt: '2024-03-08T00:00:00Z'
  }
];

// Mock Customers
export const mockCustomers: Customer[] = [
  {
    id: '1',
    email: 'alice.johnson@email.com',
    name: 'Alice Johnson',
    phone: '+1 (555) 123-4567',
    avatar: 'https://i.pravatar.cc/150?u=alice',
    addresses: [
      {
        id: 'a1',
        firstName: 'Alice',
        lastName: 'Johnson',
        address1: '123 Main Street',
        city: 'New York',
        province: 'NY',
        country: 'US',
        zip: '10001'
      }
    ],
    defaultAddress: {
      id: 'a1',
      firstName: 'Alice',
      lastName: 'Johnson',
      address1: '123 Main Street',
      city: 'New York',
      province: 'NY',
      country: 'US',
      zip: '10001'
    },
    orderCount: 5,
    totalSpent: 724.95
  },
  {
    id: '2',
    email: 'bob.smith@email.com',
    name: 'Bob Smith',
    phone: '+1 (555) 987-6543',
    avatar: 'https://i.pravatar.cc/150?u=bob',
    addresses: [
      {
        id: 'a2',
        firstName: 'Bob',
        lastName: 'Smith',
        address1: '456 Oak Avenue',
        city: 'Los Angeles',
        province: 'CA',
        country: 'US',
        zip: '90001'
      }
    ],
    defaultAddress: {
      id: 'a2',
      firstName: 'Bob',
      lastName: 'Smith',
      address1: '456 Oak Avenue',
      city: 'Los Angeles',
      province: 'CA',
      country: 'US',
      zip: '90001'
    },
    orderCount: 3,
    totalSpent: 449.97
  },
  {
    id: '3',
    email: 'carol.white@email.com',
    name: 'Carol White',
    avatar: 'https://i.pravatar.cc/150?u=carol',
    addresses: [
      {
        id: 'a3',
        firstName: 'Carol',
        lastName: 'White',
        address1: '789 Pine Road',
        city: 'Chicago',
        province: 'IL',
        country: 'US',
        zip: '60601'
      }
    ],
    defaultAddress: {
      id: 'a3',
      firstName: 'Carol',
      lastName: 'White',
      address1: '789 Pine Road',
      city: 'Chicago',
      province: 'IL',
      country: 'US',
      zip: '60601'
    },
    orderCount: 8,
    totalSpent: 1234.56
  }
];

// Mock Orders
export const mockOrders: Order[] = [
  {
    id: '1',
    orderNumber: '#1001',
    customer: mockCustomers[0],
    items: [
      {
        id: 'oi1',
        productId: '1',
        variantId: 'v1',
        name: 'Wireless Bluetooth Headphones - Black',
        sku: 'WBH-001-BLK',
        quantity: 1,
        price: 149.99,
        total: 149.99,
        image: 'https://placehold.co/100x100/6366f1/ffffff?text=Headphones'
      },
      {
        id: 'oi2',
        productId: '5',
        variantId: 'v9',
        name: 'Portable Phone Charger - Black',
        sku: 'PPC-005-BLK',
        quantity: 2,
        price: 49.99,
        total: 99.98,
        image: 'https://placehold.co/100x100/3b82f6/ffffff?text=Charger'
      }
    ],
    status: 'delivered',
    paymentStatus: 'paid',
    fulfillmentStatus: 'fulfilled',
    subtotal: 249.97,
    tax: 20.00,
    shipping: 15.00,
    discount: 0,
    total: 284.97,
    currency: 'USD',
    createdAt: '2024-03-10T10:30:00Z',
    updatedAt: '2024-03-14T16:45:00Z',
    tags: ['electronics', 'repeat-customer'],
    timeline: [
      { id: 't1', type: 'order_placed', message: 'Order placed by customer', createdAt: '2024-03-10T10:30:00Z', actor: 'Alice Johnson' },
      { id: 't2', type: 'payment_processed', message: 'Payment of $284.97 processed successfully', createdAt: '2024-03-10T10:31:00Z', actor: 'System' },
      { id: 't3', type: 'fulfillment_started', message: 'Fulfillment process started', createdAt: '2024-03-10T11:00:00Z', actor: 'System' },
      { id: 't4', type: 'shipped', message: 'Order shipped via FedEx (Tracking: 1234567890)', createdAt: '2024-03-11T09:15:00Z', actor: 'Warehouse' },
      { id: 't5', type: 'delivered', message: 'Order delivered successfully', createdAt: '2024-03-14T16:45:00Z', actor: 'FedEx' }
    ],
    riskLevel: 'low'
  },
  {
    id: '2',
    orderNumber: '#1002',
    customer: mockCustomers[1],
    items: [
      {
        id: 'oi3',
        productId: '2',
        variantId: 'v4',
        name: 'Smart Watch Pro - Space Gray',
        sku: 'SWP-002-SG',
        quantity: 1,
        price: 299.99,
        total: 299.99,
        image: 'https://placehold.co/100x100/10b981/ffffff?text=Smartwatch'
      }
    ],
    status: 'shipped',
    paymentStatus: 'paid',
    fulfillmentStatus: 'fulfilled',
    subtotal: 299.99,
    tax: 24.00,
    shipping: 0,
    discount: 20.00,
    total: 303.99,
    currency: 'USD',
    createdAt: '2024-03-12T14:20:00Z',
    updatedAt: '2024-03-13T11:30:00Z',
    tags: ['electronics', 'promotion'],
    timeline: [
      { id: 't6', type: 'order_placed', message: 'Order placed by customer', createdAt: '2024-03-12T14:20:00Z', actor: 'Bob Smith' },
      { id: 't7', type: 'payment_processed', message: 'Payment of $303.99 processed successfully', createdAt: '2024-03-12T14:21:00Z', actor: 'System' },
      { id: 't8', type: 'shipped', message: 'Order shipped via UPS (Tracking: 1Z999AA10123456784)', createdAt: '2024-03-13T11:30:00Z', actor: 'Warehouse' }
    ],
    riskLevel: 'low'
  },
  {
    id: '3',
    orderNumber: '#1003',
    customer: mockCustomers[2],
    items: [
      {
        id: 'oi4',
        productId: '3',
        variantId: 'v7',
        name: 'Leather Crossbody Bag - Brown',
        sku: 'LCB-003-BRN',
        quantity: 1,
        price: 89.99,
        total: 89.99,
        image: 'https://placehold.co/100x100/92400e/ffffff?text=Bag'
      },
      {
        id: 'oi5',
        productId: '4',
        name: 'Ceramic Coffee Mug Set',
        sku: 'CCM-004',
        quantity: 2,
        price: 34.99,
        total: 69.98,
        image: 'https://placehold.co/100x100/f59e0b/ffffff?text=Mugs'
      }
    ],
    status: 'processing',
    paymentStatus: 'paid',
    fulfillmentStatus: 'unfulfilled',
    subtotal: 159.97,
    tax: 12.80,
    shipping: 8.00,
    discount: 0,
    total: 180.77,
    currency: 'USD',
    createdAt: '2024-03-13T09:00:00Z',
    updatedAt: '2024-03-13T09:01:00Z',
    tags: ['fashion', 'home'],
    timeline: [
      { id: 't9', type: 'order_placed', message: 'Order placed by customer', createdAt: '2024-03-13T09:00:00Z', actor: 'Carol White' },
      { id: 't10', type: 'payment_processed', message: 'Payment of $180.77 processed successfully', createdAt: '2024-03-13T09:01:00Z', actor: 'System' }
    ],
    riskLevel: 'medium'
  },
  {
    id: '4',
    orderNumber: '#1004',
    customer: mockCustomers[0],
    items: [
      {
        id: 'oi6',
        productId: '2',
        variantId: 'v6',
        name: 'Smart Watch Pro - Gold',
        sku: 'SWP-002-GLD',
        quantity: 1,
        price: 329.99,
        total: 329.99,
        image: 'https://placehold.co/100x100/10b981/ffffff?text=Smartwatch'
      }
    ],
    status: 'pending',
    paymentStatus: 'pending',
    fulfillmentStatus: 'unfulfilled',
    subtotal: 329.99,
    tax: 26.40,
    shipping: 15.00,
    discount: 0,
    total: 371.39,
    currency: 'USD',
    createdAt: '2024-03-14T16:00:00Z',
    updatedAt: '2024-03-14T16:00:00Z',
    tags: ['electronics', 'high-value'],
    timeline: [
      { id: 't11', type: 'order_placed', message: 'Order placed by customer', createdAt: '2024-03-14T16:00:00Z', actor: 'Alice Johnson' }
    ],
    riskLevel: 'medium'
  },
  {
    id: '5',
    orderNumber: '#1005',
    customer: mockCustomers[1],
    items: [
      {
        id: 'oi7',
        productId: '1',
        variantId: 'v2',
        name: 'Wireless Bluetooth Headphones - White',
        sku: 'WBH-001-WHT',
        quantity: 1,
        price: 149.99,
        total: 149.99,
        image: 'https://placehold.co/100x100/6366f1/ffffff?text=Headphones'
      }
    ],
    status: 'cancelled',
    paymentStatus: 'refunded',
    fulfillmentStatus: 'restocked',
    subtotal: 149.99,
    tax: 12.00,
    shipping: 0,
    discount: 0,
    total: 161.99,
    currency: 'USD',
    createdAt: '2024-03-11T11:30:00Z',
    updatedAt: '2024-03-11T14:00:00Z',
    tags: ['cancelled'],
    timeline: [
      { id: 't12', type: 'order_placed', message: 'Order placed by customer', createdAt: '2024-03-11T11:30:00Z', actor: 'Bob Smith' },
      { id: 't13', type: 'payment_processed', message: 'Payment of $161.99 processed successfully', createdAt: '2024-03-11T11:31:00Z', actor: 'System' },
      { id: 't14', type: 'note_added', message: 'Order cancelled by customer request', createdAt: '2024-03-11T14:00:00Z', actor: 'Support Team' },
      { id: 't15', type: 'refund_processed', message: 'Full refund of $161.99 processed', createdAt: '2024-03-11T14:05:00Z', actor: 'System' }
    ],
    riskLevel: 'low'
  }
];

// Mock Vendors
export const mockVendors: Vendor[] = [
  {
    id: '1',
    name: 'Tech Gadgets Pro',
    email: 'contact@techgadgets.com',
    phone: '+1 (555) 111-2222',
    logo: 'https://placehold.co/100x100/6366f1/ffffff?text=TG',
    status: 'active',
    commissionRate: 15,
    stores: [mockStores[0]],
    performance: {
      totalSales: 45678.90,
      totalOrders: 234,
      averageRating: 4.7,
      responseTime: 2.5,
      fulfillmentRate: 98.5,
      returnRate: 2.1
    },
    payoutInfo: {
      method: 'bank_transfer',
      accountDetails: '****1234',
      lastPayout: '2024-03-01T00:00:00Z',
      pendingAmount: 3245.67
    },
    createdAt: '2024-01-15T00:00:00Z',
    documents: [
      { id: 'd1', type: 'identity', status: 'approved', url: '#', uploadedAt: '2024-01-15T00:00:00Z' },
      { id: 'd2', type: 'business_license', status: 'approved', url: '#', uploadedAt: '2024-01-15T00:00:00Z' }
    ],
    riskLevel: 'low'
  },
  {
    id: '2',
    name: 'Fashion Hub',
    email: 'support@fashionhub.com',
    phone: '+1 (555) 333-4444',
    logo: 'https://placehold.co/100x100/ec4899/ffffff?text=FH',
    status: 'active',
    commissionRate: 12,
    stores: [mockStores[1]],
    performance: {
      totalSales: 28934.56,
      totalOrders: 156,
      averageRating: 4.5,
      responseTime: 4.2,
      fulfillmentRate: 95.8,
      returnRate: 4.5
    },
    payoutInfo: {
      method: 'stripe',
      accountDetails: 'acct_***xyz',
      lastPayout: '2024-03-05T00:00:00Z',
      pendingAmount: 1876.43
    },
    createdAt: '2024-02-20T00:00:00Z',
    documents: [
      { id: 'd3', type: 'identity', status: 'approved', url: '#', uploadedAt: '2024-02-20T00:00:00Z' },
      { id: 'd4', type: 'tax_document', status: 'approved', url: '#', uploadedAt: '2024-02-21T00:00:00Z' }
    ],
    riskLevel: 'low'
  },
  {
    id: '3',
    name: 'Home Essentials',
    email: 'info@homeessentials.com',
    phone: '+1 (555) 555-6666',
    logo: 'https://placehold.co/100x100/10b981/ffffff?text=HE',
    status: 'pending_approval',
    commissionRate: 10,
    stores: [mockStores[2]],
    performance: {
      totalSales: 0,
      totalOrders: 0,
      averageRating: 0,
      responseTime: 0,
      fulfillmentRate: 0,
      returnRate: 0
    },
    payoutInfo: {
      method: 'paypal',
      accountDetails: 'vendor@homeessentials.com',
      pendingAmount: 0
    },
    createdAt: '2024-03-10T00:00:00Z',
    documents: [
      { id: 'd5', type: 'identity', status: 'pending', url: '#', uploadedAt: '2024-03-10T00:00:00Z' },
      { id: 'd6', type: 'business_license', status: 'pending', url: '#', uploadedAt: '2024-03-10T00:00:00Z' }
    ],
    riskLevel: 'medium'
  }
];

// Mock Analytics
export const mockAnalytics: AnalyticsMetrics = {
  totalSales: {
    value: 74613.46,
    change: 23.5,
    changeType: 'increase'
  },
  totalOrders: {
    value: 390,
    change: 15.2,
    changeType: 'increase'
  },
  conversionRate: {
    value: 3.24,
    change: 0.8,
    changeType: 'increase'
  },
  averageOrderValue: {
    value: 191.32,
    change: 7.2,
    changeType: 'increase'
  }
};

// Mock Sales Chart Data
export const mockSalesData: SalesDataPoint[] = [
  { date: '2024-03-08', sales: 3200, orders: 18 },
  { date: '2024-03-09', sales: 4100, orders: 22 },
  { date: '2024-03-10', sales: 3800, orders: 20 },
  { date: '2024-03-11', sales: 5200, orders: 28 },
  { date: '2024-03-12', sales: 6100, orders: 32 },
  { date: '2024-03-13', sales: 4500, orders: 24 },
  { date: '2024-03-14', sales: 5800, orders: 30 }
];

// Mock Category Breakdown
export const mockCategoryBreakdown: CategoryBreakdown[] = [
  { category: 'Electronics', sales: 42345.67, percentage: 56.8 },
  { category: 'Fashion', sales: 18923.45, percentage: 25.4 },
  { category: 'Home', sales: 9876.34, percentage: 13.2 },
  { category: 'Other', sales: 3468.00, percentage: 4.6 }
];

// Mock Notifications
export const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'order',
    title: 'New Order Received',
    message: 'Order #1004 for $371.39 is pending payment',
    read: false,
    createdAt: '2024-03-14T16:00:00Z',
    actionUrl: '/orders/4'
  },
  {
    id: '2',
    type: 'alert',
    title: 'Low Stock Alert',
    message: 'Smart Watch Pro - Gold variant is running low (5 units left)',
    read: false,
    createdAt: '2024-03-14T12:30:00Z',
    actionUrl: '/products/2'
  },
  {
    id: '3',
    type: 'customer',
    title: 'New Customer Registration',
    message: 'Carol White has created an account',
    read: true,
    createdAt: '2024-03-13T08:00:00Z'
  },
  {
    id: '4',
    type: 'system',
    title: 'Payout Processed',
    message: 'Your payout of $3,245.67 has been processed',
    read: true,
    createdAt: '2024-03-01T00:00:00Z'
  },
  {
    id: '5',
    type: 'order',
    title: 'Order Shipped',
    message: 'Order #1002 has been shipped via UPS',
    read: true,
    createdAt: '2024-03-13T11:30:00Z',
    actionUrl: '/orders/2'
  }
];

// Mock Media Files
export const mockMediaFiles: MediaFile[] = [
  {
    id: 'm1',
    name: 'headphones-main.jpg',
    url: 'https://placehold.co/800x800/6366f1/ffffff?text=Headphones+Main',
    thumbnailUrl: 'https://placehold.co/200x200/6366f1/ffffff?text=Headphones',
    type: 'image',
    mimeType: 'image/jpeg',
    size: 245760,
    width: 800,
    height: 800,
    metadata: {
      alt: 'Wireless Bluetooth Headphones',
      caption: 'Premium noise-cancelling headphones',
      title: 'Wireless Bluetooth Headphones',
      description: 'High-quality wireless headphones with 30-hour battery life'
    },
    tags: ['product', 'electronics', 'headphones'],
    uploadedBy: '2',
    uploadedAt: '2024-03-01T10:00:00Z',
    updatedAt: '2024-03-01T10:00:00Z',
    usageCount: 3,
    usedIn: [{ type: 'product', id: '1', name: 'Wireless Bluetooth Headphones' }]
  },
  {
    id: 'm2',
    name: 'smartwatch-hero.jpg',
    url: 'https://placehold.co/800x800/10b981/ffffff?text=Smartwatch+Hero',
    thumbnailUrl: 'https://placehold.co/200x200/10b981/ffffff?text=Smartwatch',
    type: 'image',
    mimeType: 'image/jpeg',
    size: 189200,
    width: 800,
    height: 800,
    metadata: {
      alt: 'Smart Watch Pro',
      caption: 'Advanced fitness tracking smartwatch',
      title: 'Smart Watch Pro',
      description: 'Track your fitness goals with GPS and heart rate monitoring'
    },
    tags: ['product', 'electronics', 'smartwatch'],
    uploadedBy: '2',
    uploadedAt: '2024-03-02T14:30:00Z',
    updatedAt: '2024-03-02T14:30:00Z',
    usageCount: 2,
    usedIn: [{ type: 'product', id: '2', name: 'Smart Watch Pro' }]
  },
  {
    id: 'm3',
    name: 'leather-bag.jpg',
    url: 'https://placehold.co/800x800/92400e/ffffff?text=Leather+Bag',
    thumbnailUrl: 'https://placehold.co/200x200/92400e/ffffff?text=Bag',
    type: 'image',
    mimeType: 'image/jpeg',
    size: 312400,
    width: 800,
    height: 800,
    metadata: {
      alt: 'Leather Crossbody Bag',
      caption: 'Genuine leather crossbody bag',
      title: 'Leather Crossbody Bag',
      description: 'Handcrafted leather bag with multiple compartments'
    },
    tags: ['product', 'fashion', 'bag'],
    uploadedBy: '3',
    uploadedAt: '2024-03-03T09:15:00Z',
    updatedAt: '2024-03-03T09:15:00Z',
    usageCount: 1,
    usedIn: [{ type: 'product', id: '3', name: 'Leather Crossbody Bag' }]
  },
  {
    id: 'm4',
    name: 'coffee-mugs.jpg',
    url: 'https://placehold.co/800x800/f59e0b/ffffff?text=Coffee+Mugs',
    thumbnailUrl: 'https://placehold.co/200x200/f59e0b/ffffff?text=Mugs',
    type: 'image',
    mimeType: 'image/jpeg',
    size: 156800,
    width: 800,
    height: 800,
    metadata: {
      alt: 'Ceramic Coffee Mug Set',
      caption: 'Set of 4 handcrafted ceramic mugs',
      title: 'Ceramic Coffee Mug Set',
      description: 'Microwave and dishwasher safe ceramic mugs'
    },
    tags: ['product', 'home', 'kitchen'],
    uploadedBy: '3',
    uploadedAt: '2024-03-04T11:00:00Z',
    updatedAt: '2024-03-04T11:00:00Z',
    usageCount: 1,
    usedIn: [{ type: 'product', id: '4', name: 'Ceramic Coffee Mug Set' }]
  },
  {
    id: 'm5',
    name: 'product-demo.mp4',
    url: 'https://placehold.co/800x600/3b82f6/ffffff?text=Demo+Video',
    thumbnailUrl: 'https://placehold.co/200x150/3b82f6/ffffff?text=Video',
    type: 'video',
    mimeType: 'video/mp4',
    size: 5242880,
    width: 1920,
    height: 1080,
    duration: 120,
    metadata: {
      alt: 'Product Demo Video',
      caption: 'Watch our product in action',
      title: 'Product Demo',
      description: '2-minute product demonstration video'
    },
    tags: ['video', 'demo', 'marketing'],
    uploadedBy: '2',
    uploadedAt: '2024-03-05T16:45:00Z',
    updatedAt: '2024-03-05T16:45:00Z',
    usageCount: 0,
    usedIn: []
  },
  {
    id: 'm6',
    name: 'user-manual.pdf',
    url: 'https://placehold.co/400x500/6b7280/ffffff?text=PDF',
    type: 'document',
    mimeType: 'application/pdf',
    size: 1024000,
    metadata: {
      alt: 'User Manual',
      caption: 'Product user manual',
      title: 'User Manual',
      description: 'Complete user guide and instructions'
    },
    tags: ['document', 'manual', 'support'],
    uploadedBy: '2',
    uploadedAt: '2024-03-06T08:30:00Z',
    updatedAt: '2024-03-06T08:30:00Z',
    usageCount: 0,
    usedIn: []
  },
  {
    id: 'm7',
    name: 'store-logo.png',
    url: 'https://placehold.co/400x400/6366f1/ffffff?text=Logo',
    thumbnailUrl: 'https://placehold.co/200x200/6366f1/ffffff?text=Logo',
    type: 'image',
    mimeType: 'image/png',
    size: 45600,
    width: 400,
    height: 400,
    metadata: {
      alt: 'Store Logo',
      caption: 'Tech Gadgets Pro Logo',
      title: 'Store Logo',
      description: 'Official store logo'
    },
    tags: ['logo', 'branding'],
    folderId: 'f1',
    uploadedBy: '2',
    uploadedAt: '2024-03-01T09:00:00Z',
    updatedAt: '2024-03-01T09:00:00Z',
    usageCount: 5,
    usedIn: [{ type: 'vendor', id: '1', name: 'Tech Gadgets Pro' }]
  },
  {
    id: 'm8',
    name: 'banner-spring.jpg',
    url: 'https://placehold.co/1200x400/ec4899/ffffff?text=Spring+Banner',
    thumbnailUrl: 'https://placehold.co/300x100/ec4899/ffffff?text=Banner',
    type: 'image',
    mimeType: 'image/jpeg',
    size: 512000,
    width: 1200,
    height: 400,
    metadata: {
      alt: 'Spring Sale Banner',
      caption: 'Spring collection banner',
      title: 'Spring Sale Banner',
      description: 'Promotional banner for spring sale'
    },
    tags: ['banner', 'marketing', 'spring'],
    folderId: 'f2',
    uploadedBy: '3',
    uploadedAt: '2024-03-07T13:00:00Z',
    updatedAt: '2024-03-07T13:00:00Z',
    usageCount: 2,
    usedIn: []
  }
];

// Mock Media Folders
export const mockMediaFolders: MediaFolder[] = [
  {
    id: 'f1',
    name: 'Branding',
    createdAt: '2024-03-01T08:00:00Z'
  },
  {
    id: 'f2',
    name: 'Marketing',
    createdAt: '2024-03-02T10:00:00Z'
  },
  {
    id: 'f3',
    name: 'Product Photos',
    createdAt: '2024-03-03T09:00:00Z'
  }
];
