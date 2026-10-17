import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { ticketsService } from '@/services/tickets.service';
import {
  statusLabel, STATUS_BADGE_CLASSES, STATUS_DOT_CLASSES, openerLabel,
} from '@/components/tickets/ticket.constants';
import { isTicketCreator, ticketOpener } from '@/components/tickets/ticket.rules';
import type { Ticket } from '@/types/ticket.types';

/**
 * The tickets about this shipment's order — a customer's complaint, the
 * vendor's, one of our agents', the platform's — on the shipment itself, where
 * whoever is about to dispatch it will see them.
 *
 * Two queries, because a ticket is filed either against the order
 * (`entityType=ORDER`) or against the shipment (`entityType=SHIPMENT`). Both
 * return only tickets this agency follows, which since 2026-10-09 is every
 * ticket about an order it carries.
 *
 * Renders nothing while loading, on failure, or when there are none: this is
 * context beside the shipment, and an empty box or an error here would be noise
 * on a screen whose job is the delivery.
 */
export function ShipmentTicketsSection({ orderId, shipmentId }: { orderId: string; shipmentId: string }) {
  const { t } = useTranslation('tickets');
  const currentUserId = useCurrentUserId();
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    let active = true;
    const about = (entityType: 'ORDER' | 'SHIPMENT', entityId: string) =>
      ticketsService
        .list({ entityType, entityId, limit: 20, sortBy: 'updatedAt', sortOrder: 'desc' })
        .then((res) => res.data)
        .catch(() => [] as Ticket[]);

    Promise.all([about('ORDER', orderId), about('SHIPMENT', shipmentId)]).then(([onOrder, onShipment]) => {
      if (!active) return;
      const byId = new Map([...onOrder, ...onShipment].map((ticket) => [ticket.id, ticket]));
      setTickets([...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    });

    return () => {
      active = false;
    };
  }, [orderId, shipmentId]);

  if (tickets.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('orderTickets.title', { total: tickets.length })}
      </h3>
      <ul className="divide-y rounded-lg border">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link
              to={`/dashboard/tickets?open=${ticket.id}`}
              className="group flex items-center gap-3 p-3 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{ticket.subject}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {isTicketCreator(ticket, currentUserId)
                    ? t('people.openedByYou')
                    : t('people.openedBy', { name: openerLabel(ticketOpener(ticket)) })}
                </p>
              </div>
              <Badge className={cn('shrink-0 gap-1.5 border-0 font-medium', STATUS_BADGE_CLASSES[ticket.status])}>
                <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT_CLASSES[ticket.status])} />
                {statusLabel(ticket.status)}
              </Badge>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
