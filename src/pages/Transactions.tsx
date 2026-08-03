import { useTranslation } from 'react-i18next';
import { TransactionsTab } from '@/components/billing/TransactionsTab';
import { InfoHint } from '@/components/common/InfoHint';

export function Transactions() {
  const { t } = useTranslation('billing');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-1.5 text-2xl font-bold">
          {t('transactionsPage.title')}
          <InfoHint className="md:hidden" label={t('transactionsPage.aboutLabel')}>
            {t('transactionsPage.about')}
          </InfoHint>
        </h1>
        <p className="text-muted-foreground max-md:hidden">{t('transactionsPage.description')}</p>
        <p className="text-muted-foreground md:hidden">{t('transactionsPage.descriptionShort')}</p>
      </div>

      <TransactionsTab />
    </div>
  );
}
