import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Package,
  Download,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Check,
  Box,
  FileDigit,
  Wrench,
  Image as ImageIcon,
  Tag,
  DollarSign,
  Truck,
  Plus,
  X,
  Clock,
  MapPin,
  Video,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useProductStore, useMediaStore } from '@/store';
import { MediaPicker } from '@/components/features/MediaPicker';
import type { ProductType, MediaFile, Product } from '@/types';

type UploadStep = 'type' | 'basic' | 'media' | 'pricing' | 'variants' | 'digital' | 'service' | 'shipping' | 'review';

const steps: { id: UploadStep; label: string; icon: React.ElementType; types: ProductType[] }[] = [
  { id: 'type', label: 'Type', icon: Box, types: ['physical', 'digital', 'service'] },
  { id: 'basic', label: 'Basic Info', icon: Package, types: ['physical', 'digital', 'service'] },
  { id: 'media', label: 'Media', icon: ImageIcon, types: ['physical', 'digital', 'service'] },
  { id: 'pricing', label: 'Pricing', icon: DollarSign, types: ['physical', 'digital', 'service'] },
  { id: 'variants', label: 'Variants', icon: Tag, types: ['physical'] },
  { id: 'digital', label: 'Digital Assets', icon: FileDigit, types: ['digital'] },
  { id: 'service', label: 'Service Config', icon: Calendar, types: ['service'] },
  { id: 'shipping', label: 'Shipping', icon: Truck, types: ['physical'] },
  { id: 'review', label: 'Review', icon: Check, types: ['physical', 'digital', 'service'] },
];

const productTypeCards: { type: ProductType; title: string; description: string; icon: React.ElementType; color: string }[] = [
  {
    type: 'physical',
    title: 'Physical Product',
    description: 'Tangible items that require shipping',
    icon: Package,
    color: 'bg-blue-500',
  },
  {
    type: 'digital',
    title: 'Digital Product',
    description: 'Downloadable files like ebooks, software, or music',
    icon: Download,
    color: 'bg-purple-500',
  },
  {
    type: 'service',
    title: 'Service',
    description: 'Bookable services with time slots',
    icon: Wrench,
    color: 'bg-green-500',
  },
];

export function ProductUpload() {
  const { createProduct } = useProductStore();
  const { files } = useMediaStore();
  
  const [productType, setProductType] = useState<ProductType | null>(null);
  const [currentStep, setCurrentStep] = useState<UploadStep>('type');
  const [selectedMediaFiles, setSelectedMediaFiles] = useState<string[]>([]);
  const [digitalAssets, setDigitalAssets] = useState<{ fileId: string; name: string }[]>([]);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [variants, setVariants] = useState<{ options: { name: string; values: string[] }[]; generated: any[] }>({
    options: [],
    generated: [],
  });
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionValues, setNewOptionValues] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
  } = useForm({
    defaultValues: {
      name: '',
      description: '',
      sku: '',
      price: 0,
      compareAtPrice: undefined as number | undefined,
      costPerItem: undefined as number | undefined,
      category: '',
      tags: [] as string[],
      weight: undefined as number | undefined,
      weightUnit: 'kg' as const,
      dimensions: undefined as { length: number; width: number; height: number } | undefined,
      dimensionUnit: 'cm' as const,
      inventory: {
        quantity: 0,
        tracked: true,
        lowStockThreshold: 10,
      },
      requiresShipping: true,
      downloadLimit: undefined as number | undefined,
      downloadExpiryDays: undefined as number | undefined,
      previewEnabled: false,
      duration: undefined as number | undefined,
      durationUnit: 'hour' as const,
      locationType: 'virtual' as const,
      bufferTimeBefore: 0,
      bufferTimeAfter: 0,
    },
  });

  const inventoryTracked = watch('inventory.tracked' as const);
  const tags = watch('tags') || [];

  const getAvailableSteps = () => {
    if (!productType) return [steps[0]];
    return steps.filter(step => step.types.includes(productType));
  };

  const getCurrentStepIndex = () => {
    return getAvailableSteps().findIndex(s => s.id === currentStep);
  };

  const canProceed = () => {
    const stepIndex = getCurrentStepIndex();
    const availableSteps = getAvailableSteps();
    return stepIndex < availableSteps.length - 1;
  };

  const canGoBack = () => {
    return getCurrentStepIndex() > 0;
  };

  const handleNext = () => {
    const availableSteps = getAvailableSteps();
    const currentIndex = getCurrentStepIndex();
    if (currentIndex < availableSteps.length - 1) {
      setCurrentStep(availableSteps[currentIndex + 1].id);
    }
  };

  const handleBack = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex > 0) {
      setCurrentStep(getAvailableSteps()[currentIndex - 1].id);
    }
  };

  const handleTypeSelect = (type: ProductType) => {
    setProductType(type);
    setCurrentStep('basic');
  };

  const handleAddTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setValue('tags', [...tags, tag]);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setValue('tags', tags.filter((tag) => tag !== tagToRemove));
  };

  const handleMediaSelect = (selectedFiles: MediaFile[]) => {
    setSelectedMediaFiles(prev => [...prev, ...selectedFiles.map(f => f.id)]);
  };

  const handleRemoveMedia = (fileId: string) => {
    setSelectedMediaFiles(prev => prev.filter(id => id !== fileId));
  };

  const handleAddVariantOption = () => {
    if (newOptionName && newOptionValues) {
      const values = newOptionValues.split(',').map(v => v.trim()).filter(Boolean);
      setVariants(prev => ({
        ...prev,
        options: [...prev.options, { name: newOptionName, values }],
      }));
      setNewOptionName('');
      setNewOptionValues('');
      generateVariants();
    }
  };

  const generateVariants = () => {
    const { options } = variants;
    if (options.length === 0) return;

    const generateCombinations = (opts: typeof options, index = 0, current: string[] = []): string[][] => {
      if (index === opts.length) return [current];
      const combinations: string[][] = [];
      for (const value of opts[index].values) {
        combinations.push(...generateCombinations(opts, index + 1, [...current, value]));
      }
      return combinations;
    };

    const combinations = generateCombinations(options);
    const generated = combinations.map((combo, i) => ({
      id: `v${i}`,
      title: combo.join(' / '),
      sku: `${watch('sku')}-${combo.join('-')}`,
      price: watch('price'),
      inventory: 0,
      options: options.map((opt, idx) => ({ name: opt.name, value: combo[idx] })),
    }));

    setVariants(prev => ({ ...prev, generated }));
  };

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const baseProduct = {
        name: data.name,
        description: data.description,
        sku: data.sku,
        price: data.price,
        compareAtPrice: data.compareAtPrice,
        costPerItem: data.costPerItem,
        fileIds: selectedMediaFiles,
        status: 'draft' as const,
        vendor: 'Current Agency',
        category: data.category,
        tags: data.tags,
        seo: { title: data.name, description: data.description },
        productType: productType!,
      };

      let productData: Partial<Product>;

      if (productType === 'physical') {
        productData = {
          ...baseProduct,
          productType: 'physical',
          weight: data.weight,
          weightUnit: data.weightUnit,
          dimensions: data.dimensions,
          dimensionUnit: data.dimensionUnit,
          inventory: data.inventory,
          variants: variants.generated,
          variantStrategy: variants.generated.length > 0 ? 'variant' : 'single',
          requiresShipping: data.requiresShipping,
        };
      } else if (productType === 'digital') {
        productData = {
          ...baseProduct,
          productType: 'digital',
          digitalAssets: digitalAssets.map((asset, i) => ({
            id: `da${i}`,
            fileId: asset.fileId,
            name: asset.name,
            size: 0,
            mimeType: 'application/octet-stream',
            downloadCount: 0,
          })),
          downloadLimit: data.downloadLimit,
          downloadExpiryDays: data.downloadExpiryDays,
          previewEnabled: data.previewEnabled,
        };
      } else {
        productData = {
          ...baseProduct,
          productType: 'service',
          duration: data.duration,
          durationUnit: data.durationUnit,
          bookingSettings: {
            minAdvanceBooking: 24,
            maxAdvanceBooking: 30,
            minAdvanceUnit: 'hour',
            maxAdvanceUnit: 'day',
            allowRescheduling: true,
            cancellationPolicy: '24h',
          },
          availability: {
            timezone: 'UTC',
            schedule: {
              monday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
              tuesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
              wednesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
              thursday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
              friday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
              saturday: { enabled: false, slots: [] },
              sunday: { enabled: false, slots: [] },
            },
            exceptions: [],
          },
          staffIds: [],
          locationType: data.locationType,
          bufferTimeBefore: data.bufferTimeBefore,
          bufferTimeAfter: data.bufferTimeAfter,
        };
      }

      await createProduct(productData);
      reset();
      setProductType(null);
      setCurrentStep('type');
      setSelectedMediaFiles([]);
      setDigitalAssets([]);
      setVariants({ options: [], generated: [] });
    } catch (error) {
      console.error('Error creating product:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => {
    const availableSteps = getAvailableSteps();
    const currentIndex = getCurrentStepIndex();

    return (
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {availableSteps.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => setCurrentStep(step.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  isActive && 'bg-primary text-primary-foreground',
                  isCompleted && 'text-primary',
                  !isActive && !isCompleted && 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs',
                    isActive && 'bg-primary-foreground text-primary',
                    isCompleted && 'bg-primary text-primary-foreground',
                    !isActive && !isCompleted && 'bg-muted'
                  )}
                >
                  {isCompleted ? <Check className="w-3 h-3" /> : index + 1}
                </div>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {index < availableSteps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderTypeSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">What type of product are you creating?</h2>
        <p className="text-muted-foreground mt-2">
          Select the product type that best describes your item
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
        {productTypeCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.type}
              onClick={() => handleTypeSelect(card.type)}
              className={cn(
                'p-6 rounded-xl border-2 text-left transition-all hover:shadow-lg',
                productType === card.type
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary/50'
              )}
            >
              <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center mb-4', card.color)}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-lg">{card.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{card.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderBasicInfo = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Product Name *</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="Enter product name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Enter product description"
          rows={4}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU *</Label>
          <Input
            id="sku"
            {...register('sku')}
            placeholder="Enter SKU"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            {...register('category')}
            placeholder="Enter category"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Add a tag and press Enter"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMedia = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Product Media</h3>
          <p className="text-sm text-muted-foreground">
            Add images and videos to showcase your product
          </p>
        </div>
        <Button onClick={() => setIsMediaPickerOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Media
        </Button>
      </div>

      {selectedMediaFiles.length === 0 ? (
        <div
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
          onClick={() => setIsMediaPickerOpen(true)}
        >
          <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="font-medium">Click to select media</p>
          <p className="text-sm text-muted-foreground mt-1">
            Choose from your media gallery
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {selectedMediaFiles.map((fileId) => {
            const file = files.find(f => f.id === fileId);
            if (!file) return null;
            return (
              <div key={fileId} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                  {file.type === 'image' ? (
                    <img
                      src={file.thumbnailUrl || file.url}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveMedia(fileId)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          <button
            onClick={() => setIsMediaPickerOpen(true)}
            className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Add More</span>
          </button>
        </div>
      )}

      <MediaPicker
        open={isMediaPickerOpen}
        onClose={() => setIsMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        multiple
        acceptedTypes={['image', 'video']}
      />
    </div>
  );

  const renderPricing = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Price *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="price"
              type="number"
              step="0.01"
              {...register('price', { valueAsNumber: true })}
              className="pl-7"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="compareAtPrice">Compare at Price</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="compareAtPrice"
              type="number"
              step="0.01"
              {...register('compareAtPrice', { valueAsNumber: true })}
              className="pl-7"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="costPerItem">Cost per Item</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="costPerItem"
              type="number"
              step="0.01"
              {...register('costPerItem', { valueAsNumber: true })}
              className="pl-7"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderVariants = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-semibold">Variant Options</h3>
        <p className="text-sm text-muted-foreground">
          Add options like size, color, or material
        </p>

        <div className="flex gap-2">
          <Input
            placeholder="Option name (e.g., Size)"
            value={newOptionName}
            onChange={(e) => setNewOptionName(e.target.value)}
          />
          <Input
            placeholder="Values (comma separated)"
            value={newOptionValues}
            onChange={(e) => setNewOptionValues(e.target.value)}
          />
          <Button onClick={handleAddVariantOption}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {variants.options.length > 0 && (
          <div className="space-y-2">
            {variants.options.map((option, index) => (
              <div key={index} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <span className="font-medium">{option.name}:</span>
                <div className="flex gap-1 flex-wrap">
                  {option.values.map((value) => (
                    <Badge key={value} variant="secondary">{value}</Badge>
                  ))}
                </div>
                <button
                  onClick={() => setVariants(prev => ({
                    ...prev,
                    options: prev.options.filter((_, i) => i !== index),
                  }))}
                  className="ml-auto text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {variants.generated.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold">Generated Variants ({variants.generated.length})</h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">Variant</th>
                  <th className="text-left p-3 text-sm font-medium">SKU</th>
                  <th className="text-left p-3 text-sm font-medium">Price</th>
                  <th className="text-left p-3 text-sm font-medium">Inventory</th>
                </tr>
              </thead>
              <tbody>
                {variants.generated.map((variant) => (
                  <tr key={variant.id} className="border-t">
                    <td className="p-3">{variant.title}</td>
                    <td className="p-3">
                      <Input value={variant.sku} className="h-8" />
                    </td>
                    <td className="p-3">
                      <Input
                        type="number"
                        defaultValue={variant.price}
                        className="h-8 w-24"
                      />
                    </td>
                    <td className="p-3">
                      <Input
                        type="number"
                        defaultValue={variant.inventory}
                        className="h-8 w-24"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="font-semibold">Inventory</h3>
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <Label className="font-medium">Track Inventory</Label>
            <p className="text-sm text-muted-foreground">
              Automatically track product stock levels
            </p>
          </div>
          <Switch
            checked={inventoryTracked}
            onCheckedChange={(checked) => setValue('inventory.tracked', checked)}
          />
        </div>

        {inventoryTracked && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                {...register('inventory.quantity', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label>Low Stock Threshold</Label>
              <Input
                type="number"
                {...register('inventory.lowStockThreshold', { valueAsNumber: true })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderDigitalAssets = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-semibold">Digital Assets</h3>
        <p className="text-sm text-muted-foreground">
          Upload files that customers can download after purchase
        </p>

        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
          <FileDigit className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="font-medium">Upload digital files</p>
          <p className="text-sm text-muted-foreground mt-1">
            PDFs, ZIP files, audio, video, etc.
          </p>
          <Button variant="outline" className="mt-4 gap-2">
            <Upload className="w-4 h-4" />
            Select Files
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Download Limit (optional)</Label>
          <Input
            type="number"
            {...register('downloadLimit', { valueAsNumber: true })}
            placeholder="Unlimited"
          />
          <p className="text-xs text-muted-foreground">
            Maximum number of times a customer can download
          </p>
        </div>
        <div className="space-y-2">
          <Label>Download Expiry (days)</Label>
          <Input
            type="number"
            {...register('downloadExpiryDays', { valueAsNumber: true })}
            placeholder="Never expires"
          />
          <p className="text-xs text-muted-foreground">
            Days until download link expires
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
        <div>
          <Label className="font-medium">Enable Preview</Label>
          <p className="text-sm text-muted-foreground">
            Allow customers to preview before purchase
          </p>
        </div>
        <Switch {...register('previewEnabled')} />
      </div>
    </div>
  );

  const renderServiceConfig = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Duration</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              {...register('duration', { valueAsNumber: true })}
              placeholder="60"
            />
            <select
              {...register('durationUnit')}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="minute">Minutes</option>
              <option value="hour">Hours</option>
              <option value="day">Days</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Location Type</Label>
        <div className="grid grid-cols-3 gap-4">
          {(['virtual', 'physical', 'both'] as const).map((type) => (
            <label
              key={type}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-lg border cursor-pointer transition-colors',
                watch('locationType') === type
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary/50'
              )}
            >
              <input
                type="radio"
                value={type}
                {...register('locationType')}
                className="sr-only"
              />
              {type === 'virtual' && <Video className="w-6 h-6" />}
              {type === 'physical' && <MapPin className="w-6 h-6" />}
              {type === 'both' && <Clock className="w-6 h-6" />}
              <span className="capitalize font-medium">{type}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Buffer Time Before (minutes)</Label>
          <Input
            type="number"
            {...register('bufferTimeBefore', { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2">
          <Label>Buffer Time After (minutes)</Label>
          <Input
            type="number"
            {...register('bufferTimeAfter', { valueAsNumber: true })}
          />
        </div>
      </div>
    </div>
  );

  const renderShipping = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
        <div>
          <Label className="font-medium">Requires Shipping</Label>
          <p className="text-sm text-muted-foreground">
            This product needs to be shipped to customers
          </p>
        </div>
        <Switch {...register('requiresShipping')} />
      </div>

      {watch('requiresShipping') && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Weight</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  {...register('weight', { valueAsNumber: true })}
                  placeholder="0"
                />
                <select
                  {...register('weightUnit')}
                  className="px-3 py-2 border rounded-md bg-background"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="lb">lb</option>
                  <option value="oz">oz</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dimensions</Label>
            <div className="grid grid-cols-4 gap-2">
              <Input
                type="number"
                {...register('dimensions.length', { valueAsNumber: true })}
                placeholder="Length"
              />
              <Input
                type="number"
                {...register('dimensions.width', { valueAsNumber: true })}
                placeholder="Width"
              />
              <Input
                type="number"
                {...register('dimensions.height', { valueAsNumber: true })}
                placeholder="Height"
              />
              <select
                {...register('dimensionUnit')}
                className="px-3 py-2 border rounded-md bg-background"
              >
                <option value="cm">cm</option>
                <option value="m">m</option>
                <option value="in">in</option>
                <option value="ft">ft</option>
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderReview = () => {
    const formData = watch();
    return (
      <div className="space-y-6">
        <div className="bg-muted rounded-lg p-6 space-y-4">
          <h3 className="font-semibold text-lg">Product Summary</h3>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Type:</span>
              <span className="ml-2 font-medium capitalize">{productType}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Name:</span>
              <span className="ml-2 font-medium">{formData.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">SKU:</span>
              <span className="ml-2 font-medium">{formData.sku}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Price:</span>
              <span className="ml-2 font-medium">${formData.price}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Category:</span>
              <span className="ml-2 font-medium">{formData.category || 'None'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Media:</span>
              <span className="ml-2 font-medium">{selectedMediaFiles.length} files</span>
            </div>
          </div>

          {productType === 'physical' && variants.generated.length > 0 && (
            <div>
              <span className="text-muted-foreground">Variants:</span>
              <span className="ml-2 font-medium">{variants.generated.length} variants</span>
            </div>
          )}

          {productType === 'digital' && (
            <div>
              <span className="text-muted-foreground">Digital Assets:</span>
              <span className="ml-2 font-medium">{digitalAssets.length} files</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <Check className="w-5 h-5 text-yellow-600" />
          <p className="text-sm text-yellow-800">
            Your product will be saved as a draft. You can publish it later from the products page.
          </p>
        </div>
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'type':
        return renderTypeSelection();
      case 'basic':
        return renderBasicInfo();
      case 'media':
        return renderMedia();
      case 'pricing':
        return renderPricing();
      case 'variants':
        return renderVariants();
      case 'digital':
        return renderDigitalAssets();
      case 'service':
        return renderServiceConfig();
      case 'shipping':
        return renderShipping();
      case 'review':
        return renderReview();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Create Product</h1>
          <p className="text-muted-foreground">
            Add a new product to your store
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      {productType && (
        <Card>
          <CardContent className="p-4">
            {renderStepIndicator()}
          </CardContent>
        </Card>
      )}

      {/* Form Content */}
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(onSubmit)}>
            {renderCurrentStep()}
          </form>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={!canGoBack()}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>

        {currentStep === 'review' ? (
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="gap-2"
          >
            <Check className="w-4 h-4" />
            {isSubmitting ? 'Creating...' : 'Create Product'}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="gap-2"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
