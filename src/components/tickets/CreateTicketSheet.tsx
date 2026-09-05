import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';
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
  ticketTypeGroupLabel,
  ticketTypeLabel,
  IMPORTANCE_OPTIONS,
  importanceLabel,
  AGENCY_ENTITY_TYPES,
  entityTypeLabel,
  SEARCHABLE_ENTITY_TYPES,
  DESCRIPTION_MAX_LENGTH,
  SUBJECT_MAX_LENGTH,
  TRACKING_NUMBER_MAX,
  responsiveSheetProps,
  shipmentStatusLabel,
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
  const { t } = useTranslation(['tickets', 'common']);
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
      toast.error(t('create.errors.subjectTooShort'));
      return;
    }
    if (description.trim().length < 10) {
      toast.error(t('create.errors.descriptionTooShort'));
      return;
    }
    if (needsReference && !entityId.trim()) {
      toast.error(t('create.errors.entityRequired'));
      return;
    }
    if (trackingRequired && !trackingNumber.trim()) {
      toast.error(t('create.errors.trackingRequired'));
      return;
    }
    if (attachmentRequired && attachments.length === 0) {
      toast.error(t('create.errors.attachmentRequired'));
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
        success: t('create.toasts.created'),
        // `errorOverrides` values are translation keys, not copy — they go
        // through `getApiErrorMessage`, which resolves them via i18next.
        errorOverrides: {
          TICKET_ENTITY_NOT_FOUND: 'tickets:create.errors.entityNotFound',
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
          <SheetTitle>{t('create.title')}</SheetTitle>
          <SheetDescription>{t('create.description')}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="ticket-subject">
              {t('create.subject')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ticket-subject"
              value={subject}
              maxLength={SUBJECT_MAX_LENGTH}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('create.subjectPlaceholder')}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="ticket-description">
              {t('create.descriptionLabel')} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="ticket-description"
              rows={5}
              value={description}
              maxLength={DESCRIPTION_MAX_LENGTH}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('create.descriptionPlaceholder')}
            />
            <p className="text-end text-xs tabular-nums text-muted-foreground">
              {t('create.charCount', { current: description.length, max: DESCRIPTION_MAX_LENGTH })}
            </p>
          </div>

          {/* Type + Importance */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                {t('create.type')} <span className="text-destructive">*</span>
              </Label>
              <Select value={type} onValueChange={(v) => setType(v as TicketType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_TYPE_GROUPS.map((g) => (
                    <SelectGroup key={g.key}>
                      <SelectLabel>{ticketTypeGroupLabel(g.key)}</SelectLabel>
                      {g.values.map((v) => (
                        <SelectItem key={v} value={v}>{ticketTypeLabel(v)}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                {t('create.importance')} <span className="text-destructive">*</span>
              </Label>
              <Select value={importance} onValueChange={(v) => setImportance(v as TicketImportance)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORTANCE_OPTIONS.map((i) => (
                    <SelectItem key={i} value={i}>{importanceLabel(i)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('create.importanceHint')}</p>
            </div>
          </div>

          {/* Related entity */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                {t('create.relatedTo')} <span className="text-destructive">*</span>
              </Label>
              <Select value={entityType} onValueChange={(v) => changeEntityType(v as TicketEntityType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENCY_ENTITY_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>{entityTypeLabel(value)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>
                {t('create.item')}{' '}
                {needsReference ? (
                  <span className="text-destructive">*</span>
                ) : (
                  <span className="text-xs font-normal text-muted-foreground">
                    {t('create.optional')}
                  </span>
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
                {t('create.trackingNumber')}{' '}
                {trackingRequired ? (
                  <span className="text-destructive">*</span>
                ) : (
                  <span className="text-xs font-normal text-muted-foreground">
                    {t('create.optional')}
                  </span>
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
                    <SelectValue placeholder={t('create.trackingSelectPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {trackingOptions.map((o) => (
                      <SelectItem key={o.trackingNumber} value={o.trackingNumber}>
                        <span className="flex flex-col">
                          <span className="font-medium">{o.trackingNumber}</span>
                          <span className="text-xs text-muted-foreground">
                            {o.deliveryStatus
                              ? t('create.trackingOptionMeta', {
                                  agency: o.agencyName ?? t('create.trackingAgencyFallback'),
                                  status: shipmentStatusLabel(o.deliveryStatus),
                                })
                              : o.agencyName ?? t('create.trackingAgencyFallback')}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                    <SelectItem value={MANUAL}>{t('create.trackingManual')}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Input
                    id="ticket-tracking"
                    value={trackingNumber}
                    maxLength={TRACKING_NUMBER_MAX}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder={t('create.trackingPlaceholder')}
                  />
                  {trackingOptions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setTrackingManual(false); setTrackingNumber(''); }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t('create.trackingBackToList')}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Attachments */}
          <div className="space-y-1.5">
            <Label>
              {t('create.attachments')}{' '}
              {attachmentRequired ? (
                <span className="text-destructive">*</span>
              ) : (
                <span className="text-xs font-normal text-muted-foreground">
                  {t('create.optional')}
                </span>
              )}
            </Label>
            <FileUploadField
              value={attachments}
              onChange={setAttachments}
              max={5}
              label={t('create.addAttachment')}
            />
            {attachments.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t('create.attachmentsHint')}
              </p>
            )}
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('create.submit')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
