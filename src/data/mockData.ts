import type {
  User, Order,
  AnalyticsMetrics, SalesDataPoint, CategoryBreakdown,
  Notification, Customer, Transaction, Ticket,
  StorageItem,
} from '@/types';

// Mock Users
export const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@jovimall.com',
    name: 'Admin User',
    avatar: 'https://i.pravatar.cc/150?u=admin',
    role: 'admin',
    permissions: [
      { resource: '*', actions: ['create', 'read', 'update', 'delete'] }
    ]
  },
  {
    id: '2',
    email: 'agency@example.com',
    name: 'Littoral Express',
    avatar: 'https://i.pravatar.cc/150?u=agency',
    role: 'agency',
    permissions: [
      { resource: 'deliveries', actions: ['read', 'update'] },
      { resource: 'analytics', actions: ['read'] }
    ]
  },
];

// Mock Customers (delivery recipients)
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

// Mock Orders (deliveries assigned to this agency)
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

// Mock Coverage Breakdown (revenue by coverage region)
export const mockCategoryBreakdown: CategoryBreakdown[] = [
  { category: 'Littoral', sales: 42345.67, percentage: 56.8 },
  { category: 'Centre', sales: 18923.45, percentage: 25.4 },
  { category: 'West', sales: 9876.34, percentage: 13.2 },
  { category: 'Northwest', sales: 3468.00, percentage: 4.6 }
];

// Mock Notifications
export const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'delivery',
    title: 'New Delivery Assigned',
    message: 'Order #1004 for $371.39 is awaiting pickup',
    read: false,
    createdAt: '2024-03-14T16:00:00Z',
    actionUrl: '/dashboard/shipments'
  },
  {
    id: '2',
    type: 'alert',
    title: 'Delivery Delayed',
    message: 'Order #1003 has been in processing for over 24 hours',
    read: false,
    createdAt: '2024-03-14T12:30:00Z',
    actionUrl: '/dashboard/shipments'
  },
  {
    id: '3',
    type: 'ticket',
    title: 'New Ticket Response',
    message: 'Support replied to your ticket about a payout delay',
    read: true,
    createdAt: '2024-03-13T08:00:00Z',
    actionUrl: '/dashboard/tickets'
  },
  {
    id: '4',
    type: 'payout',
    title: 'Payout Processed',
    message: 'Your payout of $3,245.67 has been processed',
    read: true,
    createdAt: '2024-03-01T00:00:00Z',
    actionUrl: '/dashboard/transactions'
  },
  {
    id: '5',
    type: 'delivery',
    title: 'Delivery Completed',
    message: 'Order #1002 has been delivered successfully',
    read: true,
    createdAt: '2024-03-13T11:30:00Z',
    actionUrl: '/dashboard/shipments'
  }
];

// Mock Transactions
export const mockTransactions: Transaction[] = [
  {
    id: 'txn-1',
    category: 'earning',
    status: 'completed',
    direction: 'in',
    amount: 45.00,
    currency: 'USD',
    description: 'Delivery fee — Order #1001',
    createdAt: '2024-03-14T16:45:00Z',
  },
  {
    id: 'txn-2',
    category: 'earning',
    status: 'completed',
    direction: 'in',
    amount: 30.00,
    currency: 'USD',
    description: 'Delivery fee — Order #1002',
    createdAt: '2024-03-13T11:30:00Z',
  },
  {
    id: 'txn-3',
    category: 'payout',
    status: 'paid',
    direction: 'out',
    amount: 3245.67,
    currency: 'USD',
    description: 'Payout to Mobile Money — MTN',
    createdAt: '2024-03-01T00:00:00Z',
  },
  {
    id: 'txn-4',
    category: 'credit',
    status: 'completed',
    direction: 'in',
    amount: 20.00,
    currency: 'USD',
    description: 'Platform credit — referral bonus',
    createdAt: '2024-02-20T09:00:00Z',
  },
  {
    id: 'txn-5',
    category: 'plan',
    status: 'pending',
    direction: 'out',
    amount: 15.00,
    currency: 'USD',
    description: 'Monthly dashboard plan fee',
    createdAt: '2024-03-15T00:00:00Z',
  },
];

// Mock Tickets
export const mockTickets: Ticket[] = [
  {
    id: 'tkt-1',
    subject: 'Payout delayed by 3 days',
    description: 'My last payout was expected on March 1st but I still haven\'t received it.',
    status: 'waiting_on_admin',
    priority: 'high',
    type: 'PAYOUT_DELAY',
    createdAt: '2024-03-05T10:00:00Z',
    updatedAt: '2024-03-06T14:00:00Z',
    notes: [
      { id: 'n1', content: 'We are looking into this and will update you shortly.', author: 'Support', createdAt: '2024-03-06T14:00:00Z' },
    ],
  },
  {
    id: 'tkt-2',
    subject: 'How do I add a new coverage region?',
    description: 'I want to start delivering to the West region as well.',
    status: 'resolved',
    priority: 'low',
    type: 'POLICY_QUESTION',
    createdAt: '2024-02-20T09:00:00Z',
    updatedAt: '2024-02-21T11:00:00Z',
    notes: [
      { id: 'n2', content: 'You can update your coverage areas from Account → Business.', author: 'Support', createdAt: '2024-02-21T11:00:00Z' },
    ],
  },
  {
    id: 'tkt-3',
    subject: 'Cannot update my logo',
    description: 'The logo upload keeps failing on the branding page.',
    status: 'open',
    priority: 'medium',
    type: 'TECHNICAL_ISSUE',
    createdAt: '2024-03-14T08:00:00Z',
    updatedAt: '2024-03-14T08:00:00Z',
    notes: [],
  },
];

// Mock Storage Items (multi-vendor products held in this agency's warehouse)
export const mockStorageItems: StorageItem[] = [
  {
    id: 'stg-1',
    sku: 'TH-EAR-001',
    productName: 'Wireless Earbuds Pro',
    image: 'https://placehold.co/100x100/6366f1/ffffff?text=Earbuds',
    vendor: 'TechHub Electronics',
    category: 'Electronics',
    quantity: 120,
    reorderLevel: 30,
    unit: 'pcs',
    location: 'Aisle 1 · Bin 4',
    unitValue: 45.00,
    status: 'in_stock',
    receivedAt: '2024-02-10T09:00:00Z',
    updatedAt: '2024-03-12T09:00:00Z',
  },
  {
    id: 'stg-2',
    sku: 'TH-SPK-014',
    productName: 'Bluetooth Speaker Mini',
    image: 'https://placehold.co/100x100/3b82f6/ffffff?text=Speaker',
    vendor: 'TechHub Electronics',
    category: 'Electronics',
    quantity: 18,
    reorderLevel: 25,
    unit: 'pcs',
    location: 'Aisle 1 · Bin 7',
    unitValue: 28.50,
    status: 'low_stock',
    receivedAt: '2024-01-22T09:00:00Z',
    updatedAt: '2024-03-13T09:00:00Z',
  },
  {
    id: 'stg-3',
    sku: 'US-JKT-022',
    productName: "Men's Denim Jacket",
    image: 'https://placehold.co/100x100/475569/ffffff?text=Jacket',
    vendor: 'UrbanStyle Fashion',
    category: 'Apparel',
    quantity: 0,
    reorderLevel: 15,
    unit: 'pcs',
    location: 'Aisle 2 · Bin 2',
    unitValue: 39.99,
    status: 'out_of_stock',
    receivedAt: '2024-01-05T09:00:00Z',
    updatedAt: '2024-03-10T09:00:00Z',
  },
  {
    id: 'stg-4',
    sku: 'US-DRS-031',
    productName: 'Women\'s Summer Dress',
    image: 'https://placehold.co/100x100/ec4899/ffffff?text=Dress',
    vendor: 'UrbanStyle Fashion',
    category: 'Apparel',
    quantity: 64,
    reorderLevel: 20,
    unit: 'pcs',
    location: 'Aisle 2 · Bin 5',
    unitValue: 32.00,
    status: 'in_stock',
    receivedAt: '2024-02-28T09:00:00Z',
    updatedAt: '2024-03-11T09:00:00Z',
  },
  {
    id: 'stg-5',
    sku: 'GL-HNY-007',
    productName: 'Organic Honey 500g',
    image: 'https://placehold.co/100x100/f59e0b/ffffff?text=Honey',
    vendor: 'GreenLeaf Grocers',
    category: 'Grocery',
    quantity: 40,
    reorderLevel: 15,
    unit: 'jars',
    location: 'Aisle 3 · Bin 1',
    unitValue: 8.50,
    status: 'in_stock',
    receivedAt: '2024-03-01T09:00:00Z',
    updatedAt: '2024-03-14T09:00:00Z',
  },
  {
    id: 'stg-6',
    sku: 'GL-COF-012',
    productName: 'Roasted Arabica Coffee 1kg',
    image: 'https://placehold.co/100x100/92400e/ffffff?text=Coffee',
    vendor: 'GreenLeaf Grocers',
    category: 'Grocery',
    quantity: 12,
    reorderLevel: 20,
    unit: 'bags',
    location: 'Aisle 3 · Bin 3',
    unitValue: 14.00,
    status: 'low_stock',
    receivedAt: '2024-02-14T09:00:00Z',
    updatedAt: '2024-03-09T09:00:00Z',
  },
  {
    id: 'stg-7',
    sku: 'HC-DIN-018',
    productName: 'Ceramic Dinner Set',
    image: 'https://placehold.co/100x100/10b981/ffffff?text=Dinner+Set',
    vendor: 'HomeCraft Living',
    category: 'Home & Living',
    quantity: 22,
    reorderLevel: 10,
    unit: 'sets',
    location: 'Aisle 4 · Bin 6',
    unitValue: 56.00,
    status: 'reserved',
    receivedAt: '2024-01-30T09:00:00Z',
    updatedAt: '2024-03-08T09:00:00Z',
  },
  {
    id: 'stg-8',
    sku: 'HC-CUT-025',
    productName: 'Bamboo Cutting Board',
    image: 'https://placehold.co/100x100/78350f/ffffff?text=Cutting+Board',
    vendor: 'HomeCraft Living',
    category: 'Home & Living',
    quantity: 75,
    reorderLevel: 15,
    unit: 'pcs',
    location: 'Aisle 4 · Bin 8',
    unitValue: 12.00,
    status: 'in_stock',
    receivedAt: '2024-02-20T09:00:00Z',
    updatedAt: '2024-03-07T09:00:00Z',
  },
];
