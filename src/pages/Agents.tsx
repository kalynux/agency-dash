import { useParams } from 'react-router-dom';
import { RosterTab } from '@/components/agents/RosterTab';
import { InvitesTab } from '@/components/agents/InvitesTab';
import { RequestsTab } from '@/components/agents/RequestsTab';

const VALID_TABS = ['roster', 'invites', 'requests'] as const;
type AgentsTab = typeof VALID_TABS[number];

export function Agents() {
  const { tab } = useParams<{ tab: string }>();
  const activeTab: AgentsTab = (VALID_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as AgentsTab)
    : 'roster';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Agents</h1>
        <p className="text-muted-foreground">Manage the delivery agents affiliated with your agency</p>
      </div>

      {activeTab === 'roster' && <RosterTab />}
      {activeTab === 'invites' && <InvitesTab />}
      {activeTab === 'requests' && <RequestsTab />}
    </div>
  );
}
