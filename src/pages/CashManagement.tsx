import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SummaryTab } from '@/components/cash/SummaryTab';
import { DepositsTab } from '@/components/cash/DepositsTab';
import { RemittancesTab } from '@/components/cash/RemittancesTab';
import { DiscrepanciesTab } from '@/components/cash/DiscrepanciesTab';
import { SubPageHeader } from '@/components/layout/PageContainer';
import { TabSwipeArea } from '@/components/layout/TabSwipeArea';

const VALID_TABS = ['summary', 'deposits', 'remittances', 'discrepancies'] as const;
type CashTab = typeof VALID_TABS[number];

export function CashManagement() {
  const { t } = useTranslation('cash');
  const { tab } = useParams<{ tab: string }>();
  const activeTab: CashTab = (VALID_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as CashTab)
    : 'summary';

  return (
    <TabSwipeArea
      tabs={VALID_TABS}
      active={activeTab}
      toPath={(next) => `/dashboard/cash/${next}`}
      className="space-y-6 animate-fade-in"
    >
      <SubPageHeader
        path={`/dashboard/cash/${activeTab}`}
        description={t(`tabs.${activeTab}.description`)}
        shortDescription={t(`tabs.${activeTab}.short`)}
      />

      {activeTab === 'summary' && <SummaryTab />}
      {activeTab === 'deposits' && <DepositsTab />}
      {activeTab === 'remittances' && <RemittancesTab />}
      {activeTab === 'discrepancies' && <DiscrepanciesTab />}
    </TabSwipeArea>
  );
}
