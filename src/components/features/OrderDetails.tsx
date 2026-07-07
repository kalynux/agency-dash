import { useState } from 'react';
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  MapPin,
  CreditCard,
  User,
  AlertTriangle,
  Printer,
  MessageSquare,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { Order } from '@/types';

interface OrderDetailsProps {
  order: Order;
}

const timelineIcons = {
  order_placed: Clock,
  payment_processed: CreditCard,
  fulfillment_started: Package,
  shipped: Truck,
  delivered: CheckCircle,
  note_added: MessageSquare,
  refund_processed: CreditCard,
};

export function OrderDetails({ order }: OrderDetailsProps) {
  const [note, setNote] = useState('');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getRiskBadge = (level: string) => {
    return (
      <Badge
        variant={level === 'high' ? 'destructive' : level === 'medium' ? 'secondary' : 'outline'}
        className="gap-1"
      >
        <AlertTriangle className="w-3 h-3" />
        {level === 'low' ? 'Low Risk' : level === 'medium' ? 'Medium Risk' : 'High Risk'}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">{order.orderNumber}</h2>
            <Badge
              variant={
                order.status === 'delivered'
                  ? 'default'
                  : order.status === 'pending'
                  ? 'secondary'
                  : order.status === 'cancelled'
                  ? 'destructive'
                  : 'outline'
              }
              className="capitalize"
            >
              {order.status}
            </Badge>
            {getRiskBadge(order.riskLevel)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Placed on {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <Button size="sm">Update Status</Button>
        </div>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="items">Items ({order.items.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <img
                    src={order.customer.avatar || `https://i.pravatar.cc/150?u=${order.customer.id}`}
                    alt={order.customer.name}
                    className="w-12 h-12 rounded-full"
                  />
                  <div>
                    <p className="font-medium">{order.customer.name}</p>
                    <p className="text-sm text-muted-foreground">{order.customer.email}</p>
                    {order.customer.phone && (
                      <p className="text-sm text-muted-foreground">{order.customer.phone}</p>
                    )}
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Customer Stats</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-lg font-semibold">{order.customer.orderCount}</p>
                      <p className="text-xs text-muted-foreground">Total Orders</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">
                        {formatCurrency(order.customer.totalSpent)}
                      </p>
                      <p className="text-xs text-muted-foreground">Lifetime Value</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Address */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                {order.customer.defaultAddress ? (
                  <div className="space-y-1">
                    <p className="font-medium">
                      {order.customer.defaultAddress.firstName}{' '}
                      {order.customer.defaultAddress.lastName}
                    </p>
                    {order.customer.defaultAddress.company && (
                      <p className="text-sm">{order.customer.defaultAddress.company}</p>
                    )}
                    <p className="text-sm">{order.customer.defaultAddress.address1}</p>
                    {order.customer.defaultAddress.address2 && (
                      <p className="text-sm">{order.customer.defaultAddress.address2}</p>
                    )}
                    <p className="text-sm">
                      {order.customer.defaultAddress.city},{' '}
                      {order.customer.defaultAddress.province}{' '}
                      {order.customer.defaultAddress.zip}
                    </p>
                    <p className="text-sm">{order.customer.defaultAddress.country}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No address on file</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(order.tax)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{order.shipping === 0 ? 'Free' : formatCurrency(order.shipping)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-green-600">-{formatCurrency(order.discount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t flex justify-between">
                  <span className="font-medium">Total</span>
                  <span className="font-bold text-lg">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 text-sm font-medium">Product</th>
                    <th className="text-left p-4 text-sm font-medium">SKU</th>
                    <th className="text-center p-4 text-sm font-medium">Qty</th>
                    <th className="text-right p-4 text-sm font-medium">Price</th>
                    <th className="text-right p-4 text-sm font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-12 h-12 rounded object-cover"
                            />
                          )}
                          <div>
                            <p className="font-medium">{item.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{item.sku}</td>
                      <td className="p-4 text-center">{item.quantity}</td>
                      <td className="p-4 text-right">{formatCurrency(item.price)}</td>
                      <td className="p-4 text-right font-medium">
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-6">
                {order.timeline.map((event, index) => {
                  const Icon = timelineIcons[event.type as keyof typeof timelineIcons] || Clock;
                  const isLast = index === order.timeline.length - 1;
                  
                  return (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        {!isLast && <div className="w-0.5 flex-1 bg-border mt-2" />}
                      </div>
                      <div className="flex-1 pb-6">
                        <p className="font-medium">{event.message}</p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <span>{event.actor}</span>
                          <span>•</span>
                          <span>{formatDate(event.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Note */}
              <div className="mt-6 pt-6 border-t">
                <p className="font-medium mb-3">Add Note</p>
                <div className="flex gap-3">
                  <Textarea
                    placeholder="Add a note to this order..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="flex-1"
                  />
                  <Button className="gap-2">
                    <Send className="w-4 h-4" />
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Payment Status</p>
                  <Badge
                    variant={order.paymentStatus === 'paid' ? 'default' : 'secondary'}
                    className="mt-1 capitalize"
                  >
                    {order.paymentStatus}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Method</p>
                  <p className="font-medium mt-1">Credit Card (****4242)</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transaction ID</p>
                  <p className="font-medium mt-1 font-mono text-sm">txn_1234567890</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paid At</p>
                  <p className="font-medium mt-1">{formatDate(order.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
