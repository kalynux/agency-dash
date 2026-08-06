import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAgentsRoster } from '@/store/agents.store';
import { ConnectionsTab } from '@/components/agents/ConnectionsTab';
import { BrowseTab } from '@/components/agents/BrowseTab';
import { SubPageHeader } from '@/components/layout/PageContainer';

const VALID_TABS = ['connections', 'browse'] as const;
type AgentsTab = typeof VALID_TABS[number];

/** A 24-char hex ObjectId, which is what a contract deep-link carries. */
const CONTRACT_ID = /^[a-f\d]{24}$/i;

export function Agents() {
  const { t } = useTranslation('agents');
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
      <SubPageHeader
        path={`/dashboard/agents/${activeTab}`}
        description={t(`tabs.${activeTab}.description`)}
        shortDescription={t(`tabs.${activeTab}.short`)}
      />

      {activeTab === 'connections' && (
        <ConnectionsTab onContractChange={refetch} openContractId={openContractId} />
      )}
      {activeTab === 'browse' && <BrowseTab onContractChange={refetch} />}
    </div>
  );
}
