import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useShipmentActions } from '@/hooks/useShipmentActions';
import type { AgentSummary } from '@/types/agent.types';
import type {
  ReassignPayload,
  ReassignPickupOverride,
  ShipmentStatus,
} from '@/types/shipment.types';

/** Statuses where the parcel has left the agency — a named replacement is required. */
const POST_PICKUP: ShipmentStatus[] = ['picked_up', 'in_transit', 'failed', 'returned', 'handing_over'];

export interface ReassignDialogProps {
  shipmentId: string;
  currentAgentId: string | null;
  status: ShipmentStatus;
  agents: AgentSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReassigned: () => void;
}

export function ReassignDialog({
  shipmentId,
  currentAgentId,
  status,
  agents,
  open,
  onOpenChange,
  onReassigned,
}: ReassignDialogProps) {
  const { reassign, pendingKey } = useShipmentActions();
  const [agentId, setAgentId] = useState('');
  const [reason, setReason] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [override, setOverride] = useState<ReassignPickupOverride>({});

  const agentRequired = POST_PICKUP.includes(status);
  const isPending = pendingKey === `reassign:${shipmentId}`;

  // Only offer eligible replacements: approved membership, and not the agent being replaced.
  const replacementOptions = useMemo(
    () => agents.filter((a) => a.membershipStatus === 'active' && a.id !== currentAgentId),
    [agents, currentAgentId],
  );

  const reset = () => {
    setAgentId('');
    setReason('');
    setAdvancedOpen(false);
    setOverride({});
  };

  const setCoord = (key: 'latitude' | 'longitude', raw: string) => {
    setOverride((prev) => ({ ...prev, [key]: raw === '' ? undefined : Number(raw) }));
  };
  const setField = (key: keyof ReassignPickupOverride, raw: string) => {
    setOverride((prev) => ({ ...prev, [key]: raw === '' ? undefined : raw }));
  };

  const canSubmit =
    reason.trim().length > 0 && (!agentRequired || agentId) && !isPending;

  const handleSubmit = async () => {
    // A coordinate needs both latitude and longitude to be accepted.
    const hasLat = typeof override.latitude === 'number';
    const hasLng = typeof override.longitude === 'number';
    const cleanedOverride: ReassignPickupOverride = { ...override };
    if (hasLat !== hasLng) {
      delete cleanedOverride.latitude;
      delete cleanedOverride.longitude;
    }
    const hasOverride = Object.values(cleanedOverride).some((v) => v !== undefined && v !== '');

    const payload: ReassignPayload = {
      reason: reason.trim(),
      ...(agentId ? { agentId } : {}),
      ...(hasOverride ? { pickupLocation: cleanedOverride } : {}),
    };

    const result = await reassign(shipmentId, payload);
    if (result) {
      reset();
      onOpenChange(false);
      onReassigned();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reassign shipment</DialogTitle>
          <DialogDescription>
            Release the current agent and offer this shipment to a replacement. This is an audited
            action.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>
              Replacement agent{' '}
              {agentRequired ? (
                <span className="text-destructive">*</span>
              ) : (
                <span className="text-muted-foreground text-xs">(optional — auto-assigns if empty)</span>
              )}
            </Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder={agentRequired ? 'Choose a replacement…' : 'Auto-assign best candidate'} />
              </SelectTrigger>
              <SelectContent>
                {replacementOptions.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">No eligible agents</div>
                ) : (
                  replacementOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {agentRequired && (
              <p className="text-xs text-muted-foreground">
                The parcel has left the agency, so you must name the replacement.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reassign-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reassign-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Agent's bike broke down on Rue Joffre"
              rows={2}
            />
          </div>

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="px-0 text-muted-foreground">
                {advancedOpen ? 'Hide' : 'Override'} handover pickup location
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              <p className="text-xs text-muted-foreground">
                Leave blank to use the automatic handover point (the previous agent's last known
                location, the original pickup, or your HQ — depending on the shipment's status).
              </p>
              <Input placeholder="Label (e.g. Total station)" value={override.label ?? ''} onChange={(e) => setField('label', e.target.value)} />
              <Input placeholder="Address line 1" value={override.addressLine1 ?? ''} onChange={(e) => setField('addressLine1', e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="City" value={override.city ?? ''} onChange={(e) => setField('city', e.target.value)} />
                <Input placeholder="State/region" value={override.state ?? ''} onChange={(e) => setField('state', e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Country" value={override.country ?? ''} onChange={(e) => setField('country', e.target.value)} />
                <Input placeholder="Latitude" type="number" step="any" value={override.latitude ?? ''} onChange={(e) => setCoord('latitude', e.target.value)} />
                <Input placeholder="Longitude" type="number" step="any" value={override.longitude ?? ''} onChange={(e) => setCoord('longitude', e.target.value)} />
              </div>
              <Input placeholder="Note for the agent" value={override.note ?? ''} onChange={(e) => setField('note', e.target.value)} />
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reassign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
