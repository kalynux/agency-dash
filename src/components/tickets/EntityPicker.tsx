import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { txStatic } from '@/i18n/tx';
import { fulfillmentStatusLabel, shipmentStatusLabel } from './ticket.constants';
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
  const { t } = useTranslation('tickets');

  // AGENCY / OTHER (and any non-searchable type) fall back to a free-text id.
  if (!SEARCHABLE[entityType]) {
    return (
      <Input
        placeholder={
          entityType === 'OTHER' || entityType === 'AGENCY'
            ? t('entityPicker.placeholderAgency')
            : t('entityPicker.placeholderId')
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

function SearchablePicker({ entityType, value, onChange, onEntitySelected, invalid }: EntityPickerProps) {
  const { t } = useTranslation('tickets');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EntityOption | null>(null);
  // The picker's copy names what is being picked, and only the four searchable
  // types reach here — anything else falls back to the generic "item". Both
  // forms are needed: the trigger reads "Select order…", the list "No orders
  // found.", and neither is derivable from the other in every language.
  const noun = t(`entityPicker.nouns.${entityType}` as 'entityPicker.nouns.item', {
    defaultValue: t('entityPicker.nouns.item'),
  });
  const nouns = t(`entityPicker.nounsPlural.${entityType}` as 'entityPicker.nounsPlural.item', {
    defaultValue: t('entityPicker.nounsPlural.item'),
  });

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
              <span className="truncate text-xs text-muted-foreground">
                {t('entityPicker.selectedCaption', { caption: selected.caption })}
              </span>
            )}
          </span>
        ) : (
          <span>{t('entityPicker.trigger', { noun })}</span>
        )}
        <ChevronDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>{t('entityPicker.dialogTitle', { noun })}</DialogTitle>
            <DialogDescription>
              {entityType === 'PRODUCT'
                ? t('entityPicker.descriptionProduct')
                : t('entityPicker.descriptionOrder')}
            </DialogDescription>
          </DialogHeader>
          <Command shouldFilter={false} className="bg-transparent">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={
                entityType === 'PRODUCT'
                  ? t('entityPicker.searchProduct')
                  : t('entityPicker.searchOrder')
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
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('entityPicker.loading', { nouns })}
                </div>
              ) : results.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {t('entityPicker.empty', { nouns })}
                </div>
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
                          'flex w-full items-center gap-3 rounded-md px-2 py-2 text-start transition-colors',
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
            crossOrigin="anonymous"
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

  const unknownCustomer = txStatic('tickets:entityPicker.unknownCustomer');

  if (entityType === 'SHIPMENT' || entityType === 'DELIVERY') {
    // One row per this-agency shipment on each order; the entity id is the shipment id.
    const rows: EntityOption[] = [];
    for (const o of data) {
      for (const s of o.shipments) {
        rows.push({
          id: s.shipmentId,
          kind: 'shipment' as const,
          title: txStatic('tickets:entityPicker.orderTitle', {
            orderNumber: o.orderNumber,
            customer: o.customerName ?? unknownCustomer,
          }),
          subtitle: txStatic('tickets:entityPicker.shipmentStatus', {
            status: shipmentStatusLabel(s.status),
          }),
          caption: s.trackingNumber
            ? txStatic('tickets:entityPicker.trackingCaption', { number: s.trackingNumber })
            : undefined,
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
    title: o.customerName?.trim() || unknownCustomer,
    subtitle: txStatic('tickets:entityPicker.fulfillment', {
      status: fulfillmentStatusLabel(o.fulfillmentStatus),
    }),
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
