import { ShieldCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import { PaymentBrandStrip } from '@/components/common/PaymentBrandLogo';
import type { PaymentBrand } from '@/lib/payment-brands';

export interface ProviderNoteProps {
  /** What protects this channel, in one short line ("Secure card payment"). */
  title: string;
  /** One line on what that means for the agency's data or money. */
  note: string;
  /** Marks the channel accepts, shown at the end of the line. */
  brands?: readonly PaymentBrand[];
  className?: string;
}

/**
 * Where the card number goes, and what the channel accepts.
 *
 * Logos alone don't answer the question a card form raises — "where is this
 * number going?" — so it is said in words above them. It sits directly over the
 * card field for the same reason a padlock sits in the URL bar: the reassurance
 * has to be where the hesitation is.
 *
 * It never names the company that moves the money: the server picks that, and an
 * administrator can switch it without a release.
 */
export function ProviderNote({ title, note, brands, className }: ProviderNoteProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-muted/40 p-3',
        className,
      )}
    >
      <ShieldCheck className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs leading-snug text-muted-foreground">{note}</p>
      </div>
      {brands && brands.length > 0 && <PaymentBrandStrip brands={brands} className="ms-auto" />}
    </div>
  );
}
