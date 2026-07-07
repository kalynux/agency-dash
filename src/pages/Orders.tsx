import { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Download,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Eye,
  Calendar,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useOrderStore } from '@/store';
import { OrderDetails } from '@/components/features/OrderDetails';
import type { Order } from '@/types';
import { cn } from '@/lib/utils';

const statusOptions = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-500' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-blue-500' },
  { value: 'processing', label: 'Processing', color: 'bg-purple-500' },
  { value: 'shipped', label: 'Shipped', color: 'bg-indigo-500' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-500' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-500' },
  { value: 'refunded', label: 'Refunded', color: 'bg-gray-500' },
];

export function Orders() {
  const { orders, selectedOrders, isLoading, fetchOrders, toggleOrderSelection, selectAllOrders } = useOrderStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = orders.filter((order: Order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(order.status);
    
    return matchesSearch && matchesStatus;
  });

  const toggleStatusFilter = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge
        variant="outline"
        className={cn(
          'capitalize',
          status === 'delivered' && 'border-green-500 text-green-600 bg-green-50',
          status === 'pending' && 'border-yellow-500 text-yellow-600 bg-yellow-50',
          status === 'processing' && 'border-purple-500 text-purple-600 bg-purple-50',
          status === 'shipped' && 'border-indigo-500 text-indigo-600 bg-indigo-50',
          status === 'cancelled' && 'border-red-500 text-red-600 bg-red-50',
          status === 'refunded' && 'border-gray-500 text-gray-600 bg-gray-50'
        )}
      >
        <span className={cn('w-2 h-2 rounded-full mr-1.5', 
          statusOptions.find(s => s.value === status)?.color
        )} />
        {status}
      </Badge>
    );
  };

  const getPaymentBadge = (status: string) => {
    return (
      <Badge
        variant={status === 'paid' ? 'default' : 'secondary'}
        className="capitalize"
      >
        {status}
      </Badge>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  };

  const allSelected = filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground">
            Manage and track customer orders
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button className="gap-2">
            <Package className="w-4 h-4" />
            Create Order
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search orders by number, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                  {statusFilter.length > 0 && (
                    <span className="ml-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {statusFilter.length}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filter Orders</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  <div>
                    <h4 className="text-sm font-medium mb-3">Order Status</h4>
                    <div className="space-y-2">
                      {statusOptions.map((status) => (
                        <label
                          key={status.value}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={statusFilter.includes(status.value)}
                            onCheckedChange={() => toggleStatusFilter(status.value)}
                          />
                          <span className="capitalize">{status.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          {selectedOrders.length > 0 && (
            <div className="flex items-center gap-2 p-4 bg-muted/50 border-b">
              <span className="text-sm text-muted-foreground">
                {selectedOrders.length} selected
              </span>
              <div className="flex-1" />
              <Button variant="outline" size="sm" className="gap-2">
                <Truck className="w-4 h-4" />
                Mark as Shipped
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <CheckCircle className="w-4 h-4" />
                Mark as Delivered
              </Button>
              <Button variant="destructive" size="sm" className="gap-2">
                <XCircle className="w-4 h-4" />
                Cancel
              </Button>
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-12 p-4">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectAllOrders(filteredOrders.map((o: Order) => o.id));
                        } else {
                          selectAllOrders([]);
                        }
                      }}
                    />
                  </th>
                  <th className="text-left p-4 text-sm font-medium">Order</th>
                  <th className="text-left p-4 text-sm font-medium">Customer</th>
                  <th className="text-left p-4 text-sm font-medium">Date</th>
                  <th className="text-left p-4 text-sm font-medium">Status</th>
                  <th className="text-left p-4 text-sm font-medium">Payment</th>
                  <th className="text-right p-4 text-sm font-medium">Total</th>
                  <th className="w-12 p-4"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={8} className="p-4">
                        <div className="h-12 bg-muted animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Package className="w-12 h-12 text-muted-foreground" />
                        <p className="text-muted-foreground">No orders found</p>
                        <Button variant="outline" onClick={() => { setSearchQuery(''); setStatusFilter([]); }}>
                          Clear filters
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order: Order) => (
                    <tr
                      key={order.id}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-4">
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={() => toggleOrderSelection(order.id)}
                        />
                      </td>
                      <td className="p-4">
                        <div className="font-medium">{order.orderNumber}</div>
                        <div className="text-sm text-muted-foreground">
                          {order.items.length} items
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={order.customer.avatar || `https://i.pravatar.cc/150?u=${order.customer.id}`}
                            alt={order.customer.name}
                            className="w-8 h-8 rounded-full"
                          />
                          <div>
                            <div className="font-medium">{order.customer.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {order.customer.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {formatDate(order.createdAt)}
                        </div>
                      </td>
                      <td className="p-4">{getStatusBadge(order.status)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-muted-foreground" />
                          {getPaymentBadge(order.paymentStatus)}
                        </div>
                      </td>
                      <td className="p-4 text-right font-medium">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(order)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Truck className="w-4 h-4 mr-2" />
                              Mark as Shipped
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <XCircle className="w-4 h-4 mr-2" />
                              Cancel Order
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {filteredOrders.length} of {orders.length} orders
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">
                1
              </Button>
              <Button variant="outline" size="sm">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {selectedOrder && <OrderDetails order={selectedOrder} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
