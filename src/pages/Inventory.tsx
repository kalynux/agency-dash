import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StockTab } from '@/components/inventory/StockTab';
import { StockRequestsTab } from '@/components/inventory/requests/StockRequestsTab';
import { SubPageHeader } from '@/components/layout/PageContainer';

const VALID_TABS = ['stock', 'requests'] as const;
type InventoryTab = (typeof VALID_TABS)[number];

/**
 * Inventory — the SKUs this agency warehouses, and the stock changes awaiting a
 * signature on them.
 *
 * TWO TABS BECAUSE THERE ARE TWO JOBS. `stock` is the roster: what is on our
 * shelves, at which depot, what it should be costing. `requests` is the agency
 * half of the two-signature stock flow — on a warehoused SKU neither we nor the
 * vendor can change `variant.stock` alone, so every change is a proposal someone
 * has to answer.
 *
 * They live together rather than as separate nav items because a pending request
 * is a fact about a row on the roster: the inventory list badges it, and the
 * badge links here. See api-doc/agency/inventory.md and
 * api-doc/agency/stock-requests.md.
 */
export function Inventory() {
  const { t } = useTranslation('inventory');
  const { tab } = useParams<{ tab: string }>();
  const activeTab: InventoryTab = (VALID_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as InventoryTab)
    : 'stock';

  /**
   * Rendered BY the tab, not beside it: both tabs put their reload button in the
   * header's action slot, and that button belongs to the tab that owns the
   * request it re-runs. `sm:items-start` keeps it level with the title rather
   * than with the bottom of the description.
   */
  const renderHeader = (actions?: ReactNode) => (
    <SubPageHeader
      path={`/dashboard/inventory/${activeTab}`}
      description={t(`tabs.${activeTab}.description`)}
      shortDescription={t(`tabs.${activeTab}.short`)}
      actions={actions}
      className="sm:items-start"
    />
  );

  return (
    <div className="animate-fade-in space-y-6">
      {activeTab === 'stock' && <StockTab renderHeader={renderHeader} />}
      {activeTab === 'requests' && <StockRequestsTab renderHeader={renderHeader} />}
    </div>
  );
}
