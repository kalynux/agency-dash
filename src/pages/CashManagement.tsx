import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SummaryTab } from '@/components/cash/SummaryTab';
import { DepositsTab } from '@/components/cash/DepositsTab';
import { RemittancesTab } from '@/components/cash/RemittancesTab';
import { DiscrepanciesTab } from '@/components/cash/DiscrepanciesTab';
import { CodRestrictedBanner } from '@/components/cash/CodRestrictedBanner';
import { useCodLimit } from '@/hooks/useCodLimit';
import { usePageRefresh } from '@/store/pageRefresh.store';
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

  // Read here rather than in the Summary tab: the pause banner belongs on every
  // tab, and keying on the tab refetches each time one is opened — the agency
  // gets no notification, so this read is how it learns of a pause.
  const codLimit = useCodLimit(activeTab);
  usePageRefresh(codLimit.reload, codLimit.isLoading);

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

      {codLimit.limit?.codRestricted === true && (
        <CodRestrictedBanner since={codLimit.limit.codRestrictedAt} />
      )}

      {activeTab === 'summary' && <SummaryTab codLimit={codLimit} />}
      {activeTab === 'deposits' && <DepositsTab />}
      {activeTab === 'remittances' && <RemittancesTab />}
      {activeTab === 'discrepancies' && <DiscrepanciesTab />}
    </TabSwipeArea>
  );
}
