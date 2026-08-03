import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAgentsRoster } from '@/store/agents.store';
import { ConnectionsTab } from '@/components/agents/ConnectionsTab';
import { BrowseTab } from '@/components/agents/BrowseTab';
import { InfoHint } from '@/components/common/InfoHint';

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
      <div>
        <h1 className="flex items-center gap-1.5 text-2xl font-bold">
          {t('page.title')}
          <InfoHint className="md:hidden" label={t('page.aboutLabel')}>
            {t('page.description')}
          </InfoHint>
        </h1>
        <p className="text-muted-foreground max-md:hidden">{t('page.description')}</p>
        <p className="text-muted-foreground md:hidden">{t('page.descriptionShort')}</p>
      </div>

      {activeTab === 'connections' && (
        <ConnectionsTab onContractChange={refetch} openContractId={openContractId} />
      )}
      {activeTab === 'browse' && <BrowseTab onContractChange={refetch} />}
    </div>
  );
}
