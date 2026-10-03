import { useTranslation } from 'react-i18next';
import { Banknote, MapPinOff, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ShipmentOffer } from '@/types/shipment.types';

/**
 * Small labels for an offer that went past a rule: the agency forced it outside
 * the agent's contract regions (`coverageForced`) or above their COD cash limit
 * (`codLimitForced`), or a Wi-Mall administrator
 * pushed it (`adminOverride`, which the agency cannot set — only show it).
 * Renders nothing for an ordinary offer, or for an older server without the fields.
 */
export function OfferOverrideBadges({ offer }: { offer: Pick<ShipmentOffer, 'coverageForced' | 'codLimitForced' | 'adminOverride'> }) {
  const { t } = useTranslation('shipments');
  if (!offer.coverageForced && !offer.codLimitForced && !offer.adminOverride) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {offer.coverageForced && (
        <Badge variant="outline" className="gap-1 font-normal text-amber-800 border-amber-300 dark:text-amber-300 dark:border-amber-800">
          <MapPinOff className="w-3 h-3" /> {t('offerFlags.coverageForced')}
        </Badge>
      )}
      {offer.codLimitForced && (
        <Badge variant="outline" className="gap-1 font-normal text-amber-800 border-amber-300 dark:text-amber-300 dark:border-amber-800">
          <Banknote className="w-3 h-3" /> {t('offerFlags.codLimitForced')}
        </Badge>
      )}
      {offer.adminOverride && (
        <Badge variant="outline" className="gap-1 font-normal whitespace-normal text-start">
          <ShieldAlert className="w-3 h-3 flex-shrink-0" />
          {t('offerFlags.adminOverride', { reason: offer.adminOverride.reason })}
        </Badge>
      )}
    </div>
  );
}
