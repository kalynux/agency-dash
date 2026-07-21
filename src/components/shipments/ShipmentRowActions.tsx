import { useState } from 'react';
import { Ban, Eye, Loader2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { RejectShipmentDialog } from '@/components/shipments/RejectShipmentDialog';
import { useShipmentActions } from '@/hooks/useShipmentActions';
import { canRejectStatus, getNextActions, type ShipmentNextAction } from '@/components/shipments/shipment-actions';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { ShipmentListItem } from '@/types/shipment.types';

export interface ShipmentRowActionsProps {
  shipment: ShipmentListItem;
  /** Open the full detail view. */
  onView: () => void;
  /** Reload the list + nav badge after a mutation. */
  onChanged: () => void;
}

/**
 * Per-row action menu. Options are computed from the shipment's current state,
 * so a row only offers transitions valid from where it is now, plus rejection
 * while it's still `assigned`. Renders as a dropdown on desktop and a bottom
 * sheet of tappable rows on mobile.
 */
export function ShipmentRowActions({ shipment, onView, onChanged }: ShipmentRowActionsProps) {
  const isMobile = useIsMobile();
  const { updateStatus, pendingKey } = useShipmentActions();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const nextActions = getNextActions(shipment.status);
  const canReject = canRejectStatus(shipment.status);
  // Under the acceptance workflow, pickup needs an agent who has accepted the offer.
  const pickupBlocked = shipment.status === 'assigned' && !shipment.agentId;
  const isBusy = pendingKey === `status:${shipment.id}`;
  const isBlocked = (action: ShipmentNextAction) => pickupBlocked && action.status === 'picked_up';

  const runStatus = async (action: ShipmentNextAction) => {
    const result = await updateStatus(shipment.id, action.status, `Shipment marked “${action.label}”.`);
    if (result) onChanged();
  };

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      aria-label="Shipment actions"
      onClick={(e) => {
        e.stopPropagation();
        if (isMobile) setSheetOpen(true);
      }}
    >
      {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
    </Button>
  );

  return (
    <>
      {isMobile ? (
        <>
          {trigger}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent side="bottom" className="gap-0 rounded-t-2xl p-0">
              <SheetHeader className="border-b pr-10 text-left">
                <SheetTitle className="truncate text-base">{shipment.orderNumber}</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <SheetActionRow
                  icon={<Eye className="w-5 h-5" />}
                  label="View details"
                  onClick={() => {
                    setSheetOpen(false);
                    onView();
                  }}
                />
                {nextActions.map((action) => {
                  const blocked = isBlocked(action);
                  return (
                    <SheetActionRow
                      key={action.status}
                      icon={<action.icon className="w-5 h-5" />}
                      label={action.label}
                      hint={blocked ? 'Needs an assigned agent' : undefined}
                      disabled={blocked}
                      destructive={action.variant === 'destructive'}
                      onClick={() => {
                        setSheetOpen(false);
                        runStatus(action);
                      }}
                    />
                  );
                })}
                {canReject && (
                  <SheetActionRow
                    icon={<Ban className="w-5 h-5" />}
                    label="Reject shipment"
                    destructive
                    onClick={() => {
                      setSheetOpen(false);
                      setRejectOpen(true);
                    }}
                  />
                )}
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={onView}>
              <Eye className="w-4 h-4" /> View details
            </DropdownMenuItem>

            {nextActions.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Update status
                </DropdownMenuLabel>
                {nextActions.map((action) => {
                  const blocked = isBlocked(action);
                  return (
                    <DropdownMenuItem
                      key={action.status}
                      disabled={blocked}
                      onSelect={() => runStatus(action)}
                      className={cn(action.variant === 'destructive' && 'text-destructive focus:text-destructive')}
                    >
                      <action.icon className="w-4 h-4" />
                      {action.label}
                      {blocked && <span className="ml-auto text-[10px] text-muted-foreground">needs agent</span>}
                    </DropdownMenuItem>
                  );
                })}
              </>
            )}

            {canReject && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setRejectOpen(true)}
                >
                  <Ban className="w-4 h-4" /> Reject shipment
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <RejectShipmentDialog
        shipmentId={shipment.id}
        orderNumber={shipment.orderNumber}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onRejected={onChanged}
      />
    </>
  );
}

function SheetActionRow({
  icon,
  label,
  hint,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-3 px-5 py-3.5 text-left text-sm transition-colors hover:bg-muted active:bg-muted disabled:opacity-50 disabled:pointer-events-none',
        destructive && 'text-destructive',
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </button>
  );
}
