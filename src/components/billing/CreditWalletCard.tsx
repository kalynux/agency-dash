import { useTranslation } from 'react-i18next';
import { Wallet, Plus, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InfoHint } from '@/components/common/InfoHint';
import { sectionRuleClass, sectionSurfaceClass } from '@/components/layout/PageContainer';
import { cn } from '@/lib/utils';
import type { CreditPack } from '@/types/billing.types';
import { formatMoney, formatCredits } from './billing.constants';
import { ManageOnWebNotice } from './ManageOnWebNotice';

interface CreditWalletCardProps {
  balance: number;
  packs: CreditPack[];
  /**
   * Start a top-up. Omitted where purchases are gated (native — D4 / Phase 5):
   * the packs stay listed with their prices, and the notice below them replaces
   * the Buy buttons in place, since they live inside this card's body.
   */
  onBuyPack?: (pack: CreditPack) => void;
}

export function CreditWalletCard({ balance, packs, onBuyPack }: CreditWalletCardProps) {
  const { t } = useTranslation('billing');
  // A chargeback/refund claw-back on a top-up can drive the wallet below zero.
  const negative = balance < 0;
  return (
    <Card className={cn(sectionSurfaceClass, sectionRuleClass)}>
      <CardHeader className="max-md:px-0">
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" /> {t('wallet.title')}
          <InfoHint className="md:hidden" label={t('wallet.aboutLabel')}>
            {t('wallet.description')}
          </InfoHint>
        </CardTitle>
        <CardDescription className="max-md:hidden">{t('wallet.description')}</CardDescription>
        <CardDescription className="md:hidden">{t('wallet.descriptionShort')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 max-md:px-0">
        <div className={cn('rounded-lg border p-4', negative ? 'border-red-200 bg-red-50' : 'bg-muted/30')}>
          <p className="text-xs text-muted-foreground">{t('wallet.currentBalance')}</p>
          <p className={cn('text-3xl font-bold', negative && 'text-red-600')}>{formatCredits(balance)}</p>
          <p className="text-xs text-muted-foreground">{t('wallet.creditsUnit')}</p>
          {negative && (
            <div className="mt-3 flex items-start gap-2 text-xs text-red-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <p>{t('wallet.negative')}</p>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">{t('wallet.topUp')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {packs.map((pack) => (
              <div
                key={pack.code}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-semibold">
                    {t('wallet.packCredits', { credits: formatCredits(pack.credits) })}
                  </p>
                  <p className="text-sm text-muted-foreground">{formatMoney(pack.price, pack.currency)}</p>
                </div>
                {onBuyPack && (
                  <Button size="sm" onClick={() => onBuyPack(pack)} className="gap-1">
                    <Plus className="h-4 w-4" /> {t('wallet.buy')}
                  </Button>
                )}
              </div>
            ))}
            {packs.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('wallet.noPacks')}</p>
            )}
          </div>
          {!onBuyPack && <ManageOnWebNotice kind="topup" className="mt-3" />}
        </div>
      </CardContent>
    </Card>
  );
}
