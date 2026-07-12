import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Search,
  Filter,
  MoreHorizontal,
  Warehouse,
  Eye,
  RotateCcw,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useStorageStore } from '@/store';
import { StorageStatusBadge } from '@/components/storage/StorageStatusBadge';
import type { StorageItem } from '@/types';

const statusOptions = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'reserved', label: 'Reserved' },
];

export function Storage() {
  const { items, selectedItems, isLoading, fetchStorageItems, toggleItemSelection, selectAllItems, returnToVendor } = useStorageStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [vendorFilter, setVendorFilter] = useState<string[]>([]);

  useEffect(() => {
    fetchStorageItems();
  }, [fetchStorageItems]);

  const vendorOptions = Array.from(new Set(items.map((item) => item.vendor))).sort();

  const filteredItems = items.filter((item: StorageItem) => {
    const matchesSearch =
      item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.vendor.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(item.status);
    const matchesVendor = vendorFilter.length === 0 || vendorFilter.includes(item.vendor);

    return matchesSearch && matchesStatus && matchesVendor;
  });

  const toggleStatusFilter = (status: string) => {
    setStatusFilter((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
  };

  const toggleVendorFilter = (vendor: string) => {
    setVendorFilter((prev) => (prev.includes(vendor) ? prev.filter((v) => v !== vendor) : [...prev, vendor]));
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleReturnToVendor = async (item: StorageItem) => {
    await returnToVendor(item.id);
    toast.success(`${item.productName} was marked as returned to ${item.vendor}`);
  };

  const activeFilterCount = statusFilter.length + vendorFilter.length;
  const allSelected = filteredItems.length > 0 && selectedItems.length === filteredItems.length;
  const totalValue = filteredItems.reduce((sum, item) => sum + item.unitValue * item.quantity, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Storage</h1>
          <p className="text-muted-foreground">
            Manage vendor products held in your warehouse
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total value on hand</p>
          <p className="text-xl font-bold">{formatCurrency(totalValue)}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by product, SKU, vendor..."
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
                  {activeFilterCount > 0 && (
                    <span className="ml-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filter Storage</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  <div>
                    <h4 className="text-sm font-medium mb-3">Stock Status</h4>
                    <div className="space-y-2">
                      {statusOptions.map((status) => (
                        <label key={status.value} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={statusFilter.includes(status.value)}
                            onCheckedChange={() => toggleStatusFilter(status.value)}
                          />
                          <span>{status.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-3">Vendor</h4>
                    <div className="space-y-2">
                      {vendorOptions.map((vendor) => (
                        <label key={vendor} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={vendorFilter.includes(vendor)}
                            onCheckedChange={() => toggleVendorFilter(vendor)}
                          />
                          <span>{vendor}</span>
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

      {/* Storage Table */}
      <Card>
        <CardContent className="p-0">
          {selectedItems.length > 0 && (
            <div className="flex items-center gap-2 p-4 bg-muted/50 border-b">
              <span className="text-sm text-muted-foreground">{selectedItems.length} selected</span>
              <div className="flex-1" />
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={() => {
                  selectedItems.forEach((id) => {
                    const item = items.find((i) => i.id === id);
                    if (item) handleReturnToVendor(item);
                  });
                }}
              >
                <RotateCcw className="w-4 h-4" />
                Return to Vendor
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
                        selectAllItems(checked ? filteredItems.map((i) => i.id) : []);
                      }}
                    />
                  </th>
                  <th className="text-left p-4 text-sm font-medium">Product</th>
                  <th className="text-left p-4 text-sm font-medium">Vendor</th>
                  <th className="text-left p-4 text-sm font-medium">Location</th>
                  <th className="text-left p-4 text-sm font-medium">Quantity</th>
                  <th className="text-left p-4 text-sm font-medium">Status</th>
                  <th className="text-right p-4 text-sm font-medium">Value</th>
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
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Warehouse className="w-12 h-12 text-muted-foreground" />
                        <p className="text-muted-foreground">No storage items found</p>
                        <Button
                          variant="outline"
                          onClick={() => { setSearchQuery(''); setStatusFilter([]); setVendorFilter([]); }}
                        >
                          Clear filters
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={() => toggleItemSelection(item.id)}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.image || 'https://placehold.co/100x100/94a3b8/ffffff?text=Item'}
                            alt={item.productName}
                            className="w-10 h-10 rounded object-cover"
                          />
                          <div>
                            <div className="font-medium">{item.productName}</div>
                            <div className="text-sm text-muted-foreground">{item.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm">{item.vendor}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          {item.location}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {item.quantity} {item.unit}
                          {item.quantity <= item.reorderLevel && item.quantity > 0 && (
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">Received {formatDate(item.receivedAt)}</div>
                      </td>
                      <td className="p-4"><StorageStatusBadge status={item.status} /></td>
                      <td className="p-4 text-right font-medium">
                        {formatCurrency(item.unitValue * item.quantity)}
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleReturnToVendor(item)}>
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Return to Vendor
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

          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {filteredItems.length} of {items.length} items
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
