import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Search, UserPlus, MapPin, Briefcase, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAgentStore } from '@/store';
import { AgentRequestStatusBadge } from '@/components/agents/AgentRequestStatusBadge';
import { VEHICLE_LABELS, VEHICLE_ICONS } from '@/components/agents/vehicle.constants';

export function ApplicationsTab() {
  const { agentRequests, fetchAgents, approveAgentRequest, declineAgentRequest } = useAgentStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const filtered = agentRequests
    .filter((r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.zone.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1));

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleApprove = async (id: string, name: string) => {
    setProcessingId(id);
    await approveAgentRequest(id);
    setProcessingId(null);
    toast.success(`${name} was added to your roster`);
  };

  const handleDecline = async (id: string, name: string) => {
    setProcessingId(id);
    await declineAgentRequest(id);
    setProcessingId(null);
    toast.success(`Application from ${name} was declined`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search applications by name, zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <UserPlus className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No applications found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((request) => {
                const VehicleIcon = VEHICLE_ICONS[request.vehicle];
                const isPending = request.status === 'pending';
                return (
                  <div key={request.id} className="flex items-start gap-4 p-4">
                    <img
                      src={request.avatar || `https://i.pravatar.cc/150?u=${request.id}`}
                      alt={request.name}
                      className="w-10 h-10 rounded-full mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{request.name}</p>
                        <AgentRequestStatusBadge status={request.status} />
                      </div>
                      <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {request.zone}
                        </span>
                        <span className="flex items-center gap-1">
                          <VehicleIcon className="w-3.5 h-3.5" />
                          {VEHICLE_LABELS[request.vehicle]}
                        </span>
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5" />
                          {request.experienceYears === 0 ? 'No experience' : `${request.experienceYears} yr experience`}
                        </span>
                      </div>
                      {request.message && (
                        <p className="text-sm text-muted-foreground mt-2">{request.message}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Applied {formatDate(request.requestedAt)}
                      </p>
                    </div>
                    {isPending && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={processingId === request.id}
                          onClick={() => handleDecline(request.id, request.name)}
                        >
                          <X className="w-4 h-4" />
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          className="gap-2"
                          disabled={processingId === request.id}
                          onClick={() => handleApprove(request.id, request.name)}
                        >
                          <Check className="w-4 h-4" />
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
