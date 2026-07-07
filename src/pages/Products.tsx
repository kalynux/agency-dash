import { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  Grid3X3,
  List,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Package,
  AlertCircle,
  Image as ImageIcon,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useProductStore } from '@/store';
import { useRouter } from '@/App';
import { ProductForm } from '@/components/features/ProductForm';
import type { Product } from '@/types';

export function Products() {
  const { products, selectedProducts, isLoading, fetchProducts, toggleProductSelection, selectAllProducts, deleteProduct } = useProductStore();
  const { navigate } = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = products.filter((product: Product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(product.status);
    
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
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge
        variant={
          status === 'active'
            ? 'default'
            : status === 'draft'
            ? 'secondary'
            : 'outline'
        }
        className="capitalize"
      >
        {status}
      </Badge>
    );
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsCreateOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      await deleteProduct(id);
    }
  };

  const allSelected = filteredProducts.length > 0 && selectedProducts.length === filteredProducts.length;

  const ProductCard = ({ product }: { product: Product }) => (
    <div className="animate-fade-in">
      <Card className="group hover:shadow-lg transition-all overflow-hidden">
        <div className="relative aspect-square bg-muted">
          {product.images.length > 0 ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-muted-foreground" />
            </div>
          )}
          <div className="absolute top-3 left-3">
            <Checkbox
              checked={selectedProducts.includes(product.id)}
              onCheckedChange={() => toggleProductSelection(product.id)}
              className="bg-white/90"
            />
          </div>
          <div className="absolute top-3 right-3">
            {getStatusBadge(product.status)}
          </div>
          {product.inventory.quantity <= product.inventory.lowStockThreshold && (
            <div className="absolute bottom-3 left-3">
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="w-3 h-3" />
                Low Stock
              </Badge>
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{product.name}</h3>
              <p className="text-sm text-muted-foreground">{product.sku}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(product)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDelete(product.id)}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{formatCurrency(product.price)}</span>
              {product.compareAtPrice && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatCurrency(product.compareAtPrice)}
                </span>
              )}
            </div>
            <span className="text-sm text-muted-foreground">
              {product.inventory.quantity} in stock
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {product.category}
            </Badge>
            {product.variants.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {product.variants.length} variants
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground">
            Manage your product catalog
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Plus className="w-4 h-4" />
            Import
          </Button>
          <Button onClick={() => navigate('product-upload')} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Product
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
                placeholder="Search products by name, SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-3">
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
                    <SheetTitle>Filter Products</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-6">
                    <div>
                      <h4 className="text-sm font-medium mb-3">Status</h4>
                      <div className="space-y-2">
                        {['active', 'draft', 'archived'].map((status) => (
                          <label
                            key={status}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Checkbox
                              checked={statusFilter.includes(status)}
                              onCheckedChange={() => toggleStatusFilter(status)}
                            />
                            <span className="capitalize">{status}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
                <TabsList>
                  <TabsTrigger value="grid" className="gap-2">
                    <Grid3X3 className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="list" className="gap-2">
                    <List className="w-4 h-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Display */}
      {selectedProducts.length > 0 && (
        <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground">
            {selectedProducts.length} selected
          </span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="gap-2">
            <Package className="w-4 h-4" />
            Update Inventory
          </Button>
          <Button variant="destructive" size="sm" className="gap-2">
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </div>
      )}

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-square" />
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-6 w-1/3" />
                </CardContent>
              </Card>
            ))
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full py-12 text-center">
              <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No products found</p>
              <Button variant="outline" onClick={() => { setSearchQuery(''); setStatusFilter([]); }}>
                Clear filters
              </Button>
            </div>
          ) : (
            filteredProducts.map((product: Product) => (
              <ProductCard key={product.id} product={product} />
            ))
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-12 p-4">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectAllProducts(filteredProducts.map((p: Product) => p.id));
                        } else {
                          selectAllProducts([]);
                        }
                      }}
                    />
                  </th>
                  <th className="text-left p-4 text-sm font-medium">Product</th>
                  <th className="text-left p-4 text-sm font-medium">Status</th>
                  <th className="text-left p-4 text-sm font-medium">Inventory</th>
                  <th className="text-right p-4 text-sm font-medium">Price</th>
                  <th className="w-12 p-4"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={6} className="p-4">
                        <div className="h-12 bg-muted animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center">
                      <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">No products found</p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product: Product) => (
                    <tr
                      key={product.id}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-4">
                        <Checkbox
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={() => toggleProductSelection(product.id)}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {product.images.length > 0 ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-12 h-12 rounded object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                              <ImageIcon className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">{product.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{getStatusBadge(product.status)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span>{product.inventory.quantity}</span>
                          {product.inventory.quantity <= product.inventory.lowStockThreshold && (
                            <Badge variant="destructive" className="text-xs">
                              Low
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div>
                          <span className="font-medium">{formatCurrency(product.price)}</span>
                          {product.compareAtPrice && (
                            <span className="block text-sm text-muted-foreground line-through">
                              {formatCurrency(product.compareAtPrice)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(product)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(product.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Product Form Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Create Product'}</DialogTitle>
          </DialogHeader>
          <ProductForm 
            product={editingProduct} 
            onClose={() => { setIsCreateOpen(false); setEditingProduct(null); }} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
