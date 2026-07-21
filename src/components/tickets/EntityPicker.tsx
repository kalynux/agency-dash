import { useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Loader2, Package, ShoppingBag, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Command, CommandInput, CommandList } from '@/components/ui/command';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ticketsService } from '@/services/tickets.service';
import { getApiErrorMessage } from '@/lib/errors';
import { humanizeEnum } from './ticket.constants';
import type { TicketEntityType } from '@/types/ticket.types';

/** A tracking number offered for a picked order/shipment, with context for labelling. */
export interface OrderTrackingOption {
  trackingNumber: string;
  agencyName?: string | null;
  deliveryStatus?: string;
}

/** Normalised, display-ready option for the searchable order/product/shipment picker. */
interface EntityOption {
  id: string;
  kind: 'order' | 'product' | 'shipment';
  /** Primary line — product title, order customer, or "order · customer". */
  title: string;
  /** Secondary muted line — category or delivery status. */
  subtitle?: string;
  /** Small de-emphasised line — order number, tags, or tracking number. */
  caption?: string;
  imageUrl?: string | null;
  /** The tracking numbers to offer for this selection (order shipments / this shipment). */
  trackingOptions?: OrderTrackingOption[];
}

interface EntityPickerProps {
  entityType: TicketEntityType;
  /** Currently selected entity id (controlled). */
  value: string;
  onChange: (entityId: string) => void;
  /** Fired with tracking numbers when an order/shipment is selected, or `null` otherwise. */
  onEntitySelected?: (options: OrderTrackingOption[] | null) => void;
  invalid?: boolean;
}

/** Entity types that support a searchable picker backed by an agency reference API. */
const SEARCHABLE: Record<string, true> = { ORDER: true, PRODUCT: true, SHIPMENT: true, DELIVERY: true };

/** Reference endpoints cap the page at 50 — plenty for a searchable picker. */
const PAGE_LIMIT = 50;

export function EntityPicker({ entityType, value, onChange, onEntitySelected, invalid }: EntityPickerProps) {
  // AGENCY / OTHER (and any non-searchable type) fall back to a free-text id.
  if (!SEARCHABLE[entityType]) {
    return (
      <Input
        placeholder={
          entityType === 'OTHER' || entityType === 'AGENCY'
            ? 'Optional — leave blank to use your agency'
            : 'Enter the related item ID'
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
      />
    );
  }

  // Remount per entity type so all internal state (query, results, selection) resets cleanly.
  return (
    <SearchablePicker
      key={entityType}
      entityType={entityType}
      value={value}
      onChange={onChange}
      onEntitySelected={onEntitySelected}
      invalid={invalid}
    />
  );
}

const NOUN: Record<string, string> = {
  ORDER: 'order',
  PRODUCT: 'product',
  SHIPMENT: 'shipment',
  DELIVERY: 'delivery',
};

function SearchablePicker({ entityType, value, onChange, onEntitySelected, invalid }: EntityPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EntityOption | null>(null);
  const noun = NOUN[entityType] ?? 'item';

  // Load results (server-side search) whenever the modal is open and the query changes.
  useEffect(() => {
    if (!open) return;
    let active = true;
    const debounce = query.trim() ? 300 : 0;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      searchEntities(entityType, query.trim())
        .then((opts) => active && setResults(opts))
        .catch((err) => {
          if (!active) return;
          setError(getApiErrorMessage(err));
          setResults([]);
        })
        .finally(() => active && setLoading(false));
    }, debounce);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, entityType, query]);

  function select(option: EntityOption) {
    onChange(option.id);
    onEntitySelected?.(option.trackingOptions ?? []);
    setSelected(option);
    setOpen(false);
    setQuery('');
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-invalid={invalid}
        onClick={() => {
          setLoading(true);
          setOpen(true);
        }}
        className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground')}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-medium">{selected.title}</span>
            {selected.caption && (
              <span className="truncate text-xs text-muted-foreground">· {selected.caption}</span>
            )}
          </span>
        ) : (
          <span>Select {noun}…</span>
        )}
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>Select {noun}</DialogTitle>
            <DialogDescription>
              {entityType === 'PRODUCT'
                ? 'Search products on orders you handle by name, category, or tag.'
                : 'Search orders you handle by order number or customer.'}
            </DialogDescription>
          </DialogHeader>
          <Command shouldFilter={false} className="bg-transparent">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={
                entityType === 'PRODUCT'
                  ? 'Search by name, category, or tag…'
                  : 'Search by order number or customer…'
              }
            />
            <CommandList className="max-h-[55vh]">
              {error ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                  {error}
                </div>
              ) : loading && results.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading {noun}s…
                </div>
              ) : results.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No {noun}s found.</div>
              ) : (
                <div className="p-1">
                  {results.map((option) => {
                    const isSelected = value === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => select(option)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
                          isSelected ? 'bg-accent' : 'hover:bg-accent/60',
                        )}
                      >
                        <OptionContent option={option} />
                        <Check
                          className={cn('h-4 w-4 shrink-0 text-primary', isSelected ? 'opacity-100' : 'opacity-0')}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Renders the thumbnail + text block for a result row. */
function OptionContent({ option }: { option: EntityOption }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {option.imageUrl ? (
          <img
            src={option.imageUrl}
            alt={option.title}
            crossOrigin="use-credentials"
            className="h-full w-full object-cover"
          />
        ) : option.kind === 'product' ? (
          <Package className="h-4 w-4 text-muted-foreground" />
        ) : option.kind === 'shipment' ? (
          <Truck className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{option.title}</span>
        {option.subtitle && (
          <span className="block truncate text-xs text-muted-foreground">{option.subtitle}</span>
        )}
        {option.caption && (
          <span className="block truncate text-[11px] text-muted-foreground/70">{option.caption}</span>
        )}
      </span>
    </span>
  );
}

async function searchEntities(entityType: TicketEntityType, query: string): Promise<EntityOption[]> {
  if (entityType === 'PRODUCT') {
    const { data } = await ticketsService.referenceProducts({ q: query || undefined, limit: PAGE_LIMIT });
    return data.map((p) => ({
      id: p.id,
      kind: 'product' as const,
      title: p.title,
      subtitle: p.category ?? undefined,
      caption: p.tags?.length ? p.tags.join(', ') : undefined,
      imageUrl: p.firstFileUrl,
    }));
  }

  const { data } = await ticketsService.referenceOrders({ q: query || undefined, limit: PAGE_LIMIT });

  if (entityType === 'SHIPMENT' || entityType === 'DELIVERY') {
    // One row per this-agency shipment on each order; the entity id is the shipment id.
    const rows: EntityOption[] = [];
    for (const o of data) {
      for (const s of o.shipments) {
        rows.push({
          id: s.shipmentId,
          kind: 'shipment' as const,
          title: `${o.orderNumber} · ${o.customerName ?? 'Unknown customer'}`,
          subtitle: `Status: ${humanizeEnum(s.status)}`,
          caption: s.trackingNumber ? `Tracking ${s.trackingNumber}` : undefined,
          trackingOptions: s.trackingNumber
            ? [{ trackingNumber: s.trackingNumber, agencyName: s.agencyName, deliveryStatus: s.status }]
            : [],
        });
      }
    }
    return rows;
  }

  // ORDER
  return data.map((o) => ({
    id: o.id,
    kind: 'order' as const,
    title: o.customerName?.trim() || 'Unknown customer',
    subtitle: `Delivery: ${humanizeEnum(o.fulfillmentStatus)}`,
    caption: o.orderNumber,
    imageUrl: o.customerAvatarUrl,
    trackingOptions: o.shipments
      .filter((s) => s.trackingNumber)
      .map((s) => ({
        trackingNumber: s.trackingNumber as string,
        agencyName: s.agencyName,
        deliveryStatus: s.status,
      })),
  }));
}
