import { Badge } from '@/components/ui/badge';
import type { PaymentStatus } from '@/types';

const LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  authorized: 'Authorized',
  paid: 'Paid',
  partially_refunded: 'Partially Refunded',
  refunded: 'Refunded',
  failed: 'Failed',
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant={status === 'paid' ? 'default' : 'secondary'} className="capitalize">
      {LABELS[status]}
    </Badge>
  );
}
