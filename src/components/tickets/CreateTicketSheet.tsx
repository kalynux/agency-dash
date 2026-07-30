import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { FileUploadField } from '@/components/common/FileUploadField';
import { EntityPicker, type OrderTrackingOption } from './EntityPicker';
import { useActionRunner } from '@/hooks/useActionRunner';
import { useIsMobile } from '@/hooks/use-mobile';
import { ticketsService } from '@/services/tickets.service';
import {
  TICKET_TYPE_GROUPS,
  IMPORTANCE_OPTIONS,
  IMPORTANCE_LABELS,
  AGENCY_ENTITY_TYPES,
  ENTITY_TYPE_LABELS,
  SEARCHABLE_ENTITY_TYPES,
  DESCRIPTION_MAX_LENGTH,
  SUBJECT_MAX_LENGTH,
  TRACKING_NUMBER_MAX,
  responsiveSheetProps,
  humanizeEnum,
} from './ticket.constants';
import type { ApiFile } from '@/types/file.types';
import type { TicketType, TicketImportance, TicketEntityType } from '@/types/ticket.types';

const MANUAL = '__manual__';

interface CreateTicketSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateTicketSheet({ open, onOpenChange, onCreated }: CreateTicketSheetProps) {
  const { run, pendingKey } = useActionRunner();
  const isMobile = useIsMobile();
  const sheet = responsiveSheetProps(isMobile);

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TicketType>('SHIPPING_ISSUE');
  const [importance, setImportance] = useState<TicketImportance>('medium');
  const [entityType, setEntityType] = useState<TicketEntityType>('SHIPMENT');
  const [entityId, setEntityId] = useState('');
  const [trackingOptions, setTrackingOptions] = useState<OrderTrackingOption[]>([]);
  const [trackingManual, setTrackingManual] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [attachments, setAttachments] = useState<ApiFile[]>([]);

  const reset = () => {
    setSubject('');
    setDescription('');
    setType('SHIPPING_ISSUE');
    setImportance('medium');
    setEntityType('SHIPMENT');
    setEntityId('');
    setTrackingOptions([]);
    setTrackingManual(false);
    setTrackingNumber('');
    setAttachments([]);
  };

  // Reset the form as the sheet closes so the next open starts fresh (avoids a
  // reset-in-effect). Routed through here for programmatic closes too.
  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const needsReference = SEARCHABLE_ENTITY_TYPES.includes(entityType);
  const trackingRelevant = entityType === 'ORDER' || entityType === 'SHIPMENT' || entityType === 'DELIVERY';
  // Support-policy required-info (enforced server-side for ORDER/PRODUCT).
  const trackingRequired = entityType === 'ORDER';
  const attachmentRequired = entityType === 'ORDER' || entityType === 'PRODUCT';

  const changeEntityType = (v: TicketEntityType) => {
    setEntityType(v);
    setEntityId('');
    setTrackingOptions([]);
    setTrackingManual(false);
    setTrackingNumber('');
  };

  const handleEntitySelected = (options: OrderTrackingOption[] | null) => {
    setTrackingNumber('');
    setTrackingOptions(options ?? []);
    // No tracking numbers on the picked entity yet → drop straight to manual entry.
    setTrackingManual(options !== null && options.length === 0);
  };

  const isSubmitting = pendingKey === 'create-ticket';

  const handleSubmit = async () => {
    if (subject.trim().length < 3) {
      toast.error('Subject must be at least 3 characters.');
      return;
    }
    if (description.trim().length < 10) {
      toast.error('Please add a bit more detail to the description.');
      return;
    }
    if (needsReference && !entityId.trim()) {
      toast.error('Select the item this ticket is about.');
      return;
    }
    if (trackingRequired && !trackingNumber.trim()) {
      toast.error('A tracking number is required for order tickets.');
      return;
    }
    if (attachmentRequired && attachments.length === 0) {
      toast.error('Attach at least one photo/video for this ticket type.');
      return;
    }

    const result = await run(
      'create-ticket',
      () =>
        ticketsService.create({
          subject: subject.trim(),
          description: description.trim(),
          type,
          importance,
          entityType,
          entityId: entityId.trim() || undefined,
          trackingNumber: trackingRelevant && trackingNumber.trim() ? trackingNumber.trim() : undefined,
          attachments: attachments.length > 0 ? attachments.map((f) => f.id) : undefined,
        }),
      {
        success: 'Ticket created.',
        errorOverrides: {
          TICKET_ENTITY_NOT_FOUND: 'The selected order or product no longer exists.',
        },
      },
    );

    if (result) {
      onCreated?.();
      handleOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side={sheet.side} className={`flex flex-col p-0 ${sheet.className}`}>
        <SheetHeader className="border-b">
          <SheetTitle>New support ticket</SheetTitle>
          <SheetDescription>
            Describe your issue and link it to the related shipment, order, or product.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="ticket-subject">
              Subject <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ticket-subject"
              value={subject}
              maxLength={SUBJECT_MAX_LENGTH}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of the issue"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="ticket-description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="ticket-description"
              rows={5}
              value={description}
              maxLength={DESCRIPTION_MAX_LENGTH}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide as much detail as possible…"
            />
            <p className="text-right text-xs tabular-nums text-muted-foreground">
              {description.length}/{DESCRIPTION_MAX_LENGTH}
            </p>
          </div>

          {/* Type + Importance */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Type <span className="text-destructive">*</span>
              </Label>
              <Select value={type} onValueChange={(v) => setType(v as TicketType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_TYPE_GROUPS.map((g) => (
                    <SelectGroup key={g.groupLabel}>
                      <SelectLabel>{g.groupLabel}</SelectLabel>
                      {g.values.map((v) => (
                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Importance <span className="text-destructive">*</span>
              </Label>
              <Select value={importance} onValueChange={(v) => setImportance(v as TicketImportance)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORTANCE_OPTIONS.map((i) => (
                    <SelectItem key={i} value={i}>{IMPORTANCE_LABELS[i]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Can't be changed after creation.</p>
            </div>
          </div>

          {/* Related entity */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Related to <span className="text-destructive">*</span>
              </Label>
              <Select value={entityType} onValueChange={(v) => changeEntityType(v as TicketEntityType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENCY_ENTITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{ENTITY_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>
                Item{' '}
                {needsReference ? (
                  <span className="text-destructive">*</span>
                ) : (
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                )}
              </Label>
              <EntityPicker
                entityType={entityType}
                value={entityId}
                onChange={setEntityId}
                onEntitySelected={handleEntitySelected}
              />
            </div>
          </div>

          {/* Tracking number — relevant for order / shipment / delivery tickets */}
          {trackingRelevant && (
            <div className="space-y-1.5">
              <Label htmlFor="ticket-tracking">
                Tracking number{' '}
                {trackingRequired ? (
                  <span className="text-destructive">*</span>
                ) : (
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                )}
              </Label>

              {!trackingManual && trackingOptions.length > 0 ? (
                <Select
                  value={trackingOptions.some((o) => o.trackingNumber === trackingNumber) ? trackingNumber : ''}
                  onValueChange={(v) => {
                    if (v === MANUAL) {
                      setTrackingManual(true);
                      setTrackingNumber('');
                    } else {
                      setTrackingNumber(v);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a tracking number" />
                  </SelectTrigger>
                  <SelectContent>
                    {trackingOptions.map((o) => (
                      <SelectItem key={o.trackingNumber} value={o.trackingNumber}>
                        <span className="flex flex-col">
                          <span className="font-medium">{o.trackingNumber}</span>
                          <span className="text-xs text-muted-foreground">
                            {o.agencyName ?? 'Delivery agency'}
                            {o.deliveryStatus ? ` · ${humanizeEnum(o.deliveryStatus)}` : ''}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                    <SelectItem value={MANUAL}>Enter manually…</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Input
                    id="ticket-tracking"
                    value={trackingNumber}
                    maxLength={TRACKING_NUMBER_MAX}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g. FS-1234567890"
                  />
                  {trackingOptions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setTrackingManual(false); setTrackingNumber(''); }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Choose from this item's tracking numbers instead
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Attachments */}
          <div className="space-y-1.5">
            <Label>
              Attachments{' '}
              {attachmentRequired ? (
                <span className="text-destructive">*</span>
              ) : (
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              )}
            </Label>
            <FileUploadField value={attachments} onChange={setAttachments} max={5} label="Add attachment" />
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create ticket
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
