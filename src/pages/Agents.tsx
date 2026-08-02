import { useParams } from 'react-router-dom';
import { useAgentsRoster } from '@/store/agents.store';
import { ConnectionsTab } from '@/components/agents/ConnectionsTab';
import { BrowseTab } from '@/components/agents/BrowseTab';
import { InfoHint } from '@/components/common/InfoHint';

const VALID_TABS = ['connections', 'browse'] as const;
type AgentsTab = typeof VALID_TABS[number];

/** A 24-char hex ObjectId, which is what a contract deep-link carries. */
const CONTRACT_ID = /^[a-f\d]{24}$/i;

export function Agents() {
  const { tab } = useParams<{ tab: string }>();
  const { refetch } = useAgentsRoster();
  const isTab = (VALID_TABS as readonly string[]).includes(tab ?? '');
  const activeTab: AgentsTab = isTab ? (tab as AgentsTab) : 'connections';

  // `agent_contract.*` notifications deep-link to `agents/{contractId}`, which
  // lands on this same route. An id in the tab slot means "open that contract",
  // not "unknown tab" — the Connections tab is where it lives either way.
  const openContractId = !isTab && tab && CONTRACT_ID.test(tab) ? tab : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-1.5 text-2xl font-bold">
          Agents
          <InfoHint className="md:hidden" label="About agent contracts">
            Manage the delivery agents contracted to your agency — only contracted agents can take
            your shipments.
          </InfoHint>
        </h1>
        <p className="text-muted-foreground max-md:hidden">
          Manage the delivery agents contracted to your agency — only contracted agents can take your shipments
        </p>
        <p className="text-muted-foreground md:hidden">Manage your agent contracts</p>
      </div>

      {activeTab === 'connections' && (
        <ConnectionsTab onContractChange={refetch} openContractId={openContractId} />
      )}
      {activeTab === 'browse' && <BrowseTab onContractChange={refetch} />}
    </div>
  );
}
