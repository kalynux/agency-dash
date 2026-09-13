import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StockTab } from '@/components/inventory/StockTab';
import { StockRequestsTab } from '@/components/inventory/requests/StockRequestsTab';
import { StorageStatementsTab } from '@/components/inventory/statements/StorageStatementsTab';
import { SubPageHeader, type RenderPageHeader } from '@/components/layout/PageContainer';
import { TabSwipeArea } from '@/components/layout/TabSwipeArea';

const VALID_TABS = ['stock', 'requests', 'statements'] as const;
type InventoryTab = (typeof VALID_TABS)[number];

/**
 * Inventory — the SKUs this agency warehouses, the stock changes awaiting a
 * signature on them, and the monthly rent record they produce.
 *
 * THREE TABS BECAUSE THERE ARE THREE JOBS.
 *
 *   `stock`       the roster: what is on our shelves, at which depot, what it
 *                 should be costing — and the four verbs that move a shelf
 *                 (receipts, returns, counts, transfers).
 *   `requests`    the agency half of the two-signature stock flow. On a
 *                 warehoused SKU neither we nor the vendor can change
 *                 `variant.stock` alone, so every change is a proposal someone
 *                 has to answer.
 *   `statements`  the monthly storage-rent record per (vendor, month).
 *
 * They live together rather than as separate nav items because each is a fact
 * about a row on the roster. A pending request badges its row and links here;
 * and a statement bills **only counted stock**, so the Stock tab's counting
 * verbs are literally what produces this tab's contents — an agency that records
 * no intake is invoiced for nothing.
 *
 * See api-doc/agency/inventory.md, api-doc/agency/stock-requests.md and
 * api-doc/agency/storage-invoices.md.
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
   * request it re-runs.
   */
  const renderHeader: RenderPageHeader = (actions) => (
    <SubPageHeader
      path={`/dashboard/inventory/${activeTab}`}
      description={t(`tabs.${activeTab}.description`)}
      shortDescription={t(`tabs.${activeTab}.short`)}
      actionItems={actions}
    />
  );

  return (
    // Swipeable like every other tabbed page (Account, Agents, Cash, Settings,
    // Vendors). Without it these three were the only tabs on a phone reachable
    // *solely* through the More drawer — the gesture that works everywhere else
    // in the app did nothing here, which reads as the app having stopped
    // responding rather than as a screen that opted out.
    <TabSwipeArea
      tabs={VALID_TABS}
      active={activeTab}
      toPath={(next) => `/dashboard/inventory/${next}`}
      className="animate-fade-in space-y-6"
    >
      {activeTab === 'stock' && <StockTab renderHeader={renderHeader} />}
      {activeTab === 'requests' && <StockRequestsTab renderHeader={renderHeader} />}
      {activeTab === 'statements' && <StorageStatementsTab renderHeader={renderHeader} />}
    </TabSwipeArea>
  );
}
