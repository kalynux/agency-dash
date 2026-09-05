import { useTranslation } from 'react-i18next';
import { TransactionsTab } from '@/components/billing/TransactionsTab';
import { PageHeader } from '@/components/layout/PageContainer';

export function Transactions() {
  const { t } = useTranslation('billing');

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('transactionsPage.title')}
        description={t('transactionsPage.description')}
        shortDescription={t('transactionsPage.descriptionShort')}
      />

      <TransactionsTab />
    </div>
  );
}
