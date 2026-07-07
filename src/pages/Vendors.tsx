import { useEffect, useState } from 'react';
import {
  Search,
  Store,
  TrendingUp,
  Users,
  Star,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  Percent,
  ExternalLink,
  Mail,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useVendorStore, useAuthStore } from '@/store';
import type { Vendor } from '@/types';
import { cn } from '@/lib/utils';

export function Vendors() {
  const { user } = useAuthStore();
  const { vendors, isLoading, fetchVendors, approveVendor, suspendVendor } = useVendorStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <AlertTriangle className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    );
  }

  const filteredVendors = vendors.filter((vendor: Vendor) => {
    const matchesSearch =
      vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(vendor.status);
    
    return matchesSearch && matchesStatus;
  });

  const toggleStatusFilter = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: 'bg-green-100 text-green-800 border-green-200',
      inactive: 'bg-gray-100 text-gray-800 border-gray-200',
      pending_approval: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      suspended: 'bg-red-100 text-red-800 border-red-200',
    };
    
    return (
      <Badge
        variant="outline"
        className={cn('capitalize', variants[status] || variants.inactive)}
      >
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getRiskBadge = (level: string) => {
    return (
      <Badge
        variant={level === 'high' ? 'destructive' : level === 'medium' ? 'secondary' : 'outline'}
        className="gap-1"
      >
        <AlertTriangle className="w-3 h-3" />
        {level === 'low' ? 'Low' : level === 'medium' ? 'Medium' : 'High'} Risk
      </Badge>
    );
  };

  const handleViewDetails = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsDetailsOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Agencies</h1>
          <p className="text-muted-foreground">
            Manage agency accounts and performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Export Report
          </Button>
          <Button className="gap-2">
            <Users className="w-4 h-4" />
            Invite Agency
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Agencies</p>
                <p className="text-2xl font-bold">{vendors.length}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Store className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">
                  {vendors.filter((v: Vendor) => v.status === 'active').length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
                <p className="text-2xl font-bold">
                  {vendors.filter((v: Vendor) => v.status === 'pending_approval').length}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(vendors.reduce((acc: number, v: Vendor) => acc + v.performance.totalSales, 0))}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors by name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter by:</span>
              {['active', 'pending_approval', 'suspended'].map((status) => (
                <button
                  key={status}
                  onClick={() => toggleStatusFilter(status)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-full transition-colors',
                    statusFilter.includes(status)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  {status.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agencies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-muted rounded-lg animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredVendors.length === 0 ? (
          <div className="col-span-full py-12 text-center">
            <Store className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No agencies found</p>
            <Button variant="outline" onClick={() => { setSearchQuery(''); setStatusFilter([]); }}>
              Clear filters
            </Button>
          </div>
        ) : (
          filteredVendors.map((vendor: Vendor) => (
            <Card key={vendor.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={vendor.logo || `https://placehold.co/100x100/6366f1/ffffff?text=${vendor.name.charAt(0)}`}
                      alt={vendor.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <div>
                      <h3 className="font-semibold text-lg">{vendor.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(vendor.status)}
                        {getRiskBadge(vendor.riskLevel)}
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <span className="sr-only">Open menu</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                        </svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleViewDetails(vendor)}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      {vendor.status === 'pending_approval' && (
                        <DropdownMenuItem onClick={() => approveVendor(vendor.id)}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </DropdownMenuItem>
                      )}
                      {vendor.status === 'active' && (
                        <DropdownMenuItem onClick={() => suspendVendor(vendor.id)}>
                          <XCircle className="w-4 h-4 mr-2" />
                          Suspend
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span>{formatCurrency(vendor.performance.totalSales)} sales</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Store className="w-4 h-4 text-muted-foreground" />
                    <span>{vendor.stores.length} store(s)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Percent className="w-4 h-4 text-muted-foreground" />
                    <span>{vendor.commissionRate}% commission</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span>{vendor.performance.averageRating} rating</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Fulfillment Rate</span>
                      <span className="font-medium">{vendor.performance.fulfillmentRate}%</span>
                    </div>
                    <Progress value={vendor.performance.fulfillmentRate} className="h-2" />
                  </div>
                </div>

                {vendor.status === 'pending_approval' && (
                  <div className="mt-4 flex gap-2">
                    <Button 
                      className="flex-1" 
                      size="sm"
                      onClick={() => approveVendor(vendor.id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1" 
                      size="sm"
                      onClick={() => suspendVendor(vendor.id)}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Vendor Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Agency Details</DialogTitle>
          </DialogHeader>
          {selectedVendor && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="stores">Stores</TabsTrigger>
                <TabsTrigger value="payouts">Payouts</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="flex items-center gap-4">
                  <img
                    src={selectedVendor.logo || `https://placehold.co/100x100/6366f1/ffffff?text=${selectedVendor.name.charAt(0)}`}
                    alt={selectedVendor.name}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                  <div>
                    <h2 className="text-xl font-bold">{selectedVendor.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(selectedVendor.status)}
                      {getRiskBadge(selectedVendor.riskLevel)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Mail className="w-4 h-4" />
                        <span className="text-sm">Email</span>
                      </div>
                      <p>{selectedVendor.email}</p>
                    </CardContent>
                  </Card>
                  {selectedVendor.phone && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          <Phone className="w-4 h-4" />
                          <span className="text-sm">Phone</span>
                        </div>
                        <p>{selectedVendor.phone}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="performance" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Sales</p>
                      <p className="text-xl font-bold">
                        {formatCurrency(selectedVendor.performance.totalSales)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Orders</p>
                      <p className="text-xl font-bold">{selectedVendor.performance.totalOrders}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Avg Rating</p>
                      <p className="text-xl font-bold">{selectedVendor.performance.averageRating}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Response Time</p>
                      <p className="text-xl font-bold">{selectedVendor.performance.responseTime}h</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="stores" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedVendor.stores.map((store) => (
                    <Card key={store.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={store.logo || `https://placehold.co/100x100/6366f1/ffffff?text=${store.name.charAt(0)}`}
                            alt={store.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                          <div>
                            <p className="font-medium">{store.name}</p>
                            <p className="text-sm text-muted-foreground">{store.domain}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">{store.status}</Badge>
                          <Badge variant="outline" className="capitalize">{store.plan}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="payouts" className="space-y-4 mt-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Commission Rate</p>
                        <p className="text-xl font-bold">{selectedVendor.commissionRate}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Pending Amount</p>
                        <p className="text-xl font-bold">
                          {formatCurrency(selectedVendor.payoutInfo.pendingAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Payout Method</p>
                        <p className="font-medium capitalize">{selectedVendor.payoutInfo.method.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Last Payout</p>
                        <p className="font-medium">
                          {selectedVendor.payoutInfo.lastPayout
                            ? new Date(selectedVendor.payoutInfo.lastPayout).toLocaleDateString()
                            : 'Never'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
