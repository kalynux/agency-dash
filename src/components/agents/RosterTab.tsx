import { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  MoreHorizontal,
  Users,
  Star,
  MapPin,
  Ban,
  CheckCircle2,
  PauseCircle,
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
import { useAgentStore } from '@/store';
import { AgentStatusBadge } from '@/components/agents/AgentStatusBadge';
import { VEHICLE_LABELS, VEHICLE_ICONS } from '@/components/agents/vehicle.constants';
import type { Agent } from '@/types';

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

export function RosterTab() {
  const { agents, isLoading, fetchAgents, updateAgentStatus } = useAgentStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const filteredAgents = agents.filter((agent: Agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.zone.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(agent.status);

    return matchesSearch && matchesStatus;
  });

  const toggleStatusFilter = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const toggleSelection = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const allSelected = filteredAgents.length > 0 && selected.length === filteredAgents.length;

  const bulkUpdateStatus = async (status: Agent['status']) => {
    await Promise.all(selected.map((id) => updateAgentStatus(id, status)));
    setSelected([]);
  };

  return (
    <div className="space-y-6">
      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search agents by name, email, zone..."
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
                  {statusFilter.length > 0 && (
                    <span className="ml-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {statusFilter.length}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filter Agents</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  <div>
                    <h4 className="text-sm font-medium mb-3">Status</h4>
                    <div className="space-y-2">
                      {statusOptions.map((status) => (
                        <label key={status.value} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={statusFilter.includes(status.value)}
                            onCheckedChange={() => toggleStatusFilter(status.value)}
                          />
                          <span className="capitalize">{status.label}</span>
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

      {/* Roster Table */}
      <Card>
        <CardContent className="p-0">
          {selected.length > 0 && (
            <div className="flex items-center gap-2 p-4 bg-muted/50 border-b">
              <span className="text-sm text-muted-foreground">{selected.length} selected</span>
              <div className="flex-1" />
              <Button variant="outline" size="sm" className="gap-2" onClick={() => bulkUpdateStatus('active')}>
                <CheckCircle2 className="w-4 h-4" />
                Activate
              </Button>
              <Button variant="destructive" size="sm" className="gap-2" onClick={() => bulkUpdateStatus('suspended')}>
                <Ban className="w-4 h-4" />
                Suspend
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
                        setSelected(checked ? filteredAgents.map((a) => a.id) : []);
                      }}
                    />
                  </th>
                  <th className="text-left p-4 text-sm font-medium">Agent</th>
                  <th className="text-left p-4 text-sm font-medium">Zone</th>
                  <th className="text-left p-4 text-sm font-medium">Vehicle</th>
                  <th className="text-left p-4 text-sm font-medium">Deliveries</th>
                  <th className="text-left p-4 text-sm font-medium">Rating</th>
                  <th className="text-left p-4 text-sm font-medium">Status</th>
                  <th className="text-left p-4 text-sm font-medium">Joined</th>
                  <th className="w-12 p-4"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={9} className="p-4">
                        <div className="h-12 bg-muted animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Users className="w-12 h-12 text-muted-foreground" />
                        <p className="text-muted-foreground">No agents found</p>
                        <Button variant="outline" onClick={() => { setSearchQuery(''); setStatusFilter([]); }}>
                          Clear filters
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => {
                    const VehicleIcon = VEHICLE_ICONS[agent.vehicle];
                    return (
                      <tr key={agent.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="p-4">
                          <Checkbox
                            checked={selected.includes(agent.id)}
                            onCheckedChange={() => toggleSelection(agent.id)}
                          />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={agent.avatar || `https://i.pravatar.cc/150?u=${agent.id}`}
                              alt={agent.name}
                              className="w-8 h-8 rounded-full"
                            />
                            <div>
                              <div className="font-medium">{agent.name}</div>
                              <div className="text-sm text-muted-foreground">{agent.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            {agent.zone}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-sm">
                            <VehicleIcon className="w-4 h-4 text-muted-foreground" />
                            {VEHICLE_LABELS[agent.vehicle]}
                          </div>
                        </td>
                        <td className="p-4">{agent.deliveriesCompleted}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            {agent.rating.toFixed(1)}
                          </div>
                        </td>
                        <td className="p-4"><AgentStatusBadge status={agent.status} /></td>
                        <td className="p-4 text-sm text-muted-foreground">{formatDate(agent.joinedAt)}</td>
                        <td className="p-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {agent.status !== 'active' && (
                                <DropdownMenuItem onClick={() => updateAgentStatus(agent.id, 'active')}>
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Activate
                                </DropdownMenuItem>
                              )}
                              {agent.status !== 'inactive' && (
                                <DropdownMenuItem onClick={() => updateAgentStatus(agent.id, 'inactive')}>
                                  <PauseCircle className="w-4 h-4 mr-2" />
                                  Mark Inactive
                                </DropdownMenuItem>
                              )}
                              {agent.status !== 'suspended' && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => updateAgentStatus(agent.id, 'suspended')}
                                >
                                  <Ban className="w-4 h-4 mr-2" />
                                  Suspend
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {filteredAgents.length} of {agents.length} agents
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
