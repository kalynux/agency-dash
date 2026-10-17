import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { shipmentsService } from '@/services/shipments.service';
import { ticketsService } from '@/services/tickets.service';
import { ENTITY_ICONS } from './ticket.constants';
import type { Ticket } from '@/types/ticket.types';

type Resolution =
  /** Still asking. */
  | { state: 'pending' }
  /** A shipment this agency can open right now. */
  | { state: 'found'; shipmentId: string }
  /** About an order or shipment, but nothing of it is on our shipments list. */
  | { state: 'unavailable' }
  /** Not about an order or a shipment at all — there is nothing to link. */
  | { state: 'none' };

/**
 * The shipment of ours a ticket is about, if we can open it.
 *
 * ⚠ **A ticket's order is not necessarily on our shipments list.** An agency is
 * on a shipment from checkout and follows the order's tickets from that moment,
 * but `GET /agency/shipments` (list and detail alike) hides a shipment until the
 * vendor dispatches it — and a shipment that later moved to another agency is
 * gone from it too, while we keep following the ticket. So the link is resolved,
 * never assumed:
 *
 * - `SHIPMENT` / `DELIVERY` — ask for that shipment; a 404 means "not ours to
 *   open".
 * - `ORDER` — the ticket reference list returns our shipments on an order, with
 *   their status; anything still `pending` has not been dispatched.
 */
function useTicketShipment(type: string, id: string, reference: string | null): Resolution {
  const key = `${type}:${id}`;
  /** The last lookup's answer, tagged with what it was for. */
  const [answer, setAnswer] = useState<{ key: string; shipmentId: string | null } | null>(null);

  const linkable = !!id && (type === 'ORDER' || type === 'SHIPMENT' || type === 'DELIVERY');
  // An order is searched by its number; an unresolved one has none (its
  // `reference` is the raw id), so there is nothing to look up.
  const searchable = linkable && (type !== 'ORDER' || (!!reference && reference !== id));

  useEffect(() => {
    if (!searchable) return;
    let active = true;
    const settle = (shipmentId: string | null) => {
      if (active) setAnswer({ key, shipmentId });
    };

    if (type === 'ORDER') {
      ticketsService
        .referenceOrders({ q: reference ?? undefined, limit: 10 })
        .then(({ data }) =>
          settle(
            data.find((order) => order.id === id)?.shipments.find((s) => s.status !== 'pending')
              ?.shipmentId ?? null,
          ),
        )
        .catch(() => settle(null));
    } else {
      shipmentsService
        .getById(id)
        .then(() => settle(id))
        .catch(() => settle(null));
    }

    return () => {
      active = false;
    };
  }, [searchable, key, type, id, reference]);

  if (!linkable) return { state: 'none' };
  if (!searchable) return { state: 'unavailable' };
  if (answer?.key !== key) return { state: 'pending' };
  return answer.shipmentId
    ? { state: 'found', shipmentId: answer.shipmentId }
    : { state: 'unavailable' };
}

/**
 * The "Related to" chip of a ticket. A link into the Shipments screen when the
 * shipment is one we can open; plain text, with a line saying why, when it is
 * not.
 */
export function TicketEntityLink({ ticket }: { ticket: Ticket }) {
  const { t } = useTranslation(['tickets', 'common']);
  const type = (ticket.entity?.type ?? ticket.entity_type ?? '').toUpperCase();
  const id = ticket.entity?.id ?? ticket.entity_id ?? '';
  const resolution = useTicketShipment(type, id, ticket.entity?.reference ?? null);

  if (!ticket.entity) {
    return (
      <span className="text-muted-foreground">
        {ticket.entity_id || t('common:values.notAvailable')}
      </span>
    );
  }

  const Icon = ENTITY_ICONS[type] ?? null;
  const chip = (
    <>
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      <span className="truncate">{ticket.entity.label}</span>
    </>
  );

  if (resolution.state === 'found') {
    return (
      <Badge variant="outline" asChild className="max-w-full gap-1 hover:bg-accent">
        <Link
          to={`/dashboard/shipments?open=${resolution.shipmentId}`}
          aria-label={t('detail.openShipment', { label: ticket.entity.label })}
        >
          {chip}
          <ArrowUpRight className="h-3 w-3 shrink-0 rtl:-scale-x-100" />
        </Link>
      </Badge>
    );
  }

  return (
    <span className="flex min-w-0 flex-col items-end gap-1">
      <Badge variant="outline" className="max-w-full gap-1">{chip}</Badge>
      {resolution.state === 'unavailable' && (
        <span className="text-xs font-normal text-muted-foreground">
          {t('detail.notInShipments')}
        </span>
      )}
    </span>
  );
}
