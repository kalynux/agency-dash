import { useState } from 'react';
import { Search, Users, Star, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AsyncBoundary, EmptyState } from '@/components/common/state-views';
import { useAgentsRoster } from '@/store/agents.store';
import { useAgentActions } from '@/hooks/useAgentActions';
import { MembershipStatusBadge } from '@/components/agents/MembershipStatusBadge';
import { AgentMembershipDialog } from '@/components/agents/AgentMembershipDialog';
import { getVehicleIcon, formatVehicleType } from '@/components/agents/vehicle.constants';
import type { MembershipStatus, RosterEntry } from '@/types/agent.types';

const STATUS_FILTERS: { value: MembershipStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending requests' },
  { value: 'approved', label: 'Approved' },
  { value: 'suspended', label: 'Suspended' },
];

export function RosterTab() {
  const { roster, isLoading, error, refetch } = useAgentsRoster();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<MembershipStatus | 'all'>('all');
  const [selected, setSelected] = useState<RosterEntry | null>(null);

  const actions = useAgentActions({ onRosterChanged: refetch });

  const filtered = roster.filter((entry) => {
    if (statusFilter !== 'all' && entry.membership.status !== statusFilter) return false;
    const q = searchQuery.toLowerCase();
    return (
      entry.agent.name.toLowerCase().includes(q) ||
      entry.agent.email.toLowerCase().includes(q) ||
      entry.agent.phone.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search agents by name, email, or phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as MembershipStatus | 'all')}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <AsyncBoundary
            isLoading={isLoading && roster.length === 0}
            error={roster.length === 0 ? error : undefined}
            onRetry={refetch}
            isEmpty={!isLoading && filtered.length === 0}
            emptyState={
              <EmptyState
                icon={Users}
                title={roster.length === 0 ? 'No agents on your roster yet' : 'No agents match'}
                description={roster.length === 0 ? 'Invite an agent from the Invites tab.' : undefined}
                className="border-0"
              />
            }
          >
            <div className="divide-y">
              {filtered.map((entry) => {
                const { membership, agent, cashHeld } = entry;
                const VehicleIcon = getVehicleIcon(agent.vehicleInfo?.vehicle_type);
                const pendingApprove = actions.pendingKey === `approve:${membership.id}`;
                const pendingDecline = actions.pendingKey === `decline:${membership.id}`;
                return (
                  <div key={membership.id} className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
                    <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => setSelected(entry)}>
                      <img
                        src={agent.avatarUrl || `https://i.pravatar.cc/150?u=${agent.id}`}
                        alt={agent.name}
                        className="w-9 h-9 rounded-full flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{agent.name}</span>
                          <MembershipStatusBadge status={membership.status} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <VehicleIcon className="w-3 h-3" />
                            {agent.vehicleInfo ? formatVehicleType(agent.vehicleInfo.vehicle_type) : '—'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            {agent.trustScore}
                          </span>
                          {cashHeld > 0 && <span className="text-amber-600">Holds {cashHeld.toLocaleString()}</span>}
                        </div>
                      </div>
                    </button>

                    {membership.status === 'pending' ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button size="sm" className="gap-1" disabled={pendingApprove} onClick={() => actions.approve(membership.id)}>
                          {pendingApprove ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" disabled={pendingDecline} onClick={() => actions.decline(membership.id)}>
                          {pendingDecline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                          Decline
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" className="flex-shrink-0" onClick={() => setSelected(entry)}>
                        Manage
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </AsyncBoundary>

          {!isLoading && !error && filtered.length > 0 && (
            <div className="p-4 border-t text-sm text-muted-foreground">
              Showing {filtered.length} of {roster.length} agents
            </div>
          )}
        </CardContent>
      </Card>

      <AgentMembershipDialog
        entry={selected}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onChanged={refetch}
      />
    </div>
  );
}
