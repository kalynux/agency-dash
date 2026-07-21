import { useParams } from 'react-router-dom';
import { SummaryTab } from '@/components/cash/SummaryTab';
import { DepositsTab } from '@/components/cash/DepositsTab';
import { RemittancesTab } from '@/components/cash/RemittancesTab';
import { DiscrepanciesTab } from '@/components/cash/DiscrepanciesTab';

const VALID_TABS = ['summary', 'deposits', 'remittances', 'discrepancies'] as const;
type CashTab = typeof VALID_TABS[number];

export function CashManagement() {
  const { tab } = useParams<{ tab: string }>();
  const activeTab: CashTab = (VALID_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as CashTab)
    : 'summary';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Cash Management</h1>
        <p className="text-muted-foreground">
          Track cash-on-delivery collections as they move from customer to agent to your agency to the platform
        </p>
      </div>

      {activeTab === 'summary' && <SummaryTab />}
      {activeTab === 'deposits' && <DepositsTab />}
      {activeTab === 'remittances' && <RemittancesTab />}
      {activeTab === 'discrepancies' && <DiscrepanciesTab />}
    </div>
  );
}
