import { useParams, useNavigate } from 'react-router-dom';
import { Users, UserPlus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAgentStore } from '@/store';
import { RosterTab } from '@/components/agents/RosterTab';
import { ApplicationsTab } from '@/components/agents/ApplicationsTab';

const VALID_TABS = ['roster', 'applications'] as const;
type AgentsTab = typeof VALID_TABS[number];

export function Agents() {
  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const { agentRequests } = useAgentStore();
  const activeTab: AgentsTab = (VALID_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as AgentsTab)
    : 'roster';

  const pendingCount = agentRequests.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Agents</h1>
        <p className="text-muted-foreground">Manage the delivery agents affiliated with your agency</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => navigate(`/dashboard/agents/${v}`)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="roster" className="gap-2">
            <Users className="w-4 h-4" />
            Roster
          </TabsTrigger>
          <TabsTrigger value="applications" className="gap-2">
            <UserPlus className="w-4 h-4" />
            Applications
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 h-5 min-w-5 justify-center">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="mt-6"><RosterTab /></TabsContent>
        <TabsContent value="applications" className="mt-6"><ApplicationsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
