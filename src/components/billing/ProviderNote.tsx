import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import { PaymentBrandStrip } from '@/components/common/PaymentBrandLogo';
import type { PaymentBrand } from '@/lib/payment-brands';
import type { PaymentGateway } from '@/types/billing.types';
import { gatewayLabel } from './billing.constants';

export interface ProviderNoteProps {
  /** The processor's own name — "Stripe", "NotchPay". A brand, so not translated. */
  provider: string;
  /** One line on what that means for the agency's data or money. */
  note: string;
  /** Marks the processor accepts, shown at the end of the line. */
  brands?: readonly PaymentBrand[];
  className?: string;
}

/**
 * Who processes this channel, and what it accepts.
 *
 * Logos alone don't answer the question a card form raises — "where is this
 * number going?" — so the processor is named in words above them. It sits
 * directly over the card field for the same reason a padlock sits in the URL
 * bar: the reassurance has to be where the hesitation is.
 */
export function ProviderNote({ provider, note, brands, className }: ProviderNoteProps) {
  const { t } = useTranslation('billing');
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-muted/40 p-3',
        className,
      )}
    >
      <ShieldCheck className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t('channels.poweredBy', { provider })}</p>
        <p className="text-xs leading-snug text-muted-foreground">{note}</p>
      </div>
      {brands && brands.length > 0 && <PaymentBrandStrip brands={brands} className="ms-auto" />}
    </div>
  );
}

/**
 * "Processed by NotchPay", as a pill on a channel card. Visually it is the
 * processor's name alone — the line it sits on already reads as metadata — but a
 * screen reader gets the whole phrase, which a bare brand name would not convey.
 *
 * Only worth showing where the processor cannot be changed. Where checkout
 * offers a choice of them, the picker says it instead.
 */
export function GatewayBadge({ gateway, className }: { gateway: PaymentGateway; className?: string }) {
  const { t } = useTranslation('billing');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border bg-muted/60 px-1.5 py-px text-[10px] font-medium leading-4 text-muted-foreground',
        className,
      )}
    >
      <span className="sr-only">{t('channels.processedBy')}: </span>
      {gatewayLabel(gateway)}
    </span>
  );
}
