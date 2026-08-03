import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SummaryTab } from '@/components/cash/SummaryTab';
import { DepositsTab } from '@/components/cash/DepositsTab';
import { RemittancesTab } from '@/components/cash/RemittancesTab';
import { DiscrepanciesTab } from '@/components/cash/DiscrepanciesTab';

const VALID_TABS = ['summary', 'deposits', 'remittances', 'discrepancies'] as const;
type CashTab = typeof VALID_TABS[number];

export function CashManagement() {
  const { t } = useTranslation('cash');
  const { tab } = useParams<{ tab: string }>();
  const activeTab: CashTab = (VALID_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as CashTab)
    : 'summary';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{t('page.title')}</h1>
        <p className="text-muted-foreground">{t('page.description')}</p>
      </div>

      {activeTab === 'summary' && <SummaryTab />}
      {activeTab === 'deposits' && <DepositsTab />}
      {activeTab === 'remittances' && <RemittancesTab />}
      {activeTab === 'discrepancies' && <DiscrepanciesTab />}
    </div>
  );
}
