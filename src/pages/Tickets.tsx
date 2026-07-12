import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Search, Ticket as TicketIcon, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useTicketStore } from '@/store';
import type { Ticket } from '@/types';
import { CreateTicketSheet } from '@/components/tickets/CreateTicketSheet';
import { TicketDetailSheet } from '@/components/tickets/TicketDetailSheet';
import { FaqSheet } from '@/components/tickets/FaqSheet';
import {
  STATUS_LABELS,
  STATUS_BADGE_CLASSES,
  STATUS_DOT_CLASSES,
  PRIORITY_LABELS,
  PRIORITY_BADGE_CLASSES,
  TICKET_TYPE_LABELS,
} from '@/components/tickets/ticket.constants';

export function Tickets() {
  const { tickets, fetchTickets } = useTicketStore();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(
    () => Boolean((location.state as { create?: boolean } | null)?.create),
  );
  const [faqOpen, setFaqOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const filtered = tickets.filter((t) =>
    t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tickets</h1>
          <p className="text-muted-foreground">Get help from the Jovi Mall support team</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={() => setFaqOpen(true)}>
            <HelpCircle className="w-4 h-4" />
            FAQ
          </Button>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            New Ticket
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <TicketIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No tickets found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className="w-full flex items-start gap-4 p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className={cn('mt-1.5 w-2 h-2 rounded-full flex-shrink-0', STATUS_DOT_CLASSES[ticket.status])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{ticket.subject}</p>
                      <Badge variant="outline" className={cn('text-xs', STATUS_BADGE_CLASSES[ticket.status])}>
                        {STATUS_LABELS[ticket.status]}
                      </Badge>
                      <Badge variant="outline" className={cn('text-xs', PRIORITY_BADGE_CLASSES[ticket.priority])}>
                        {PRIORITY_LABELS[ticket.priority]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{ticket.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {TICKET_TYPE_LABELS[ticket.type]} · Updated {formatDate(ticket.updatedAt)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateTicketSheet open={createOpen} onOpenChange={setCreateOpen} />
      <TicketDetailSheet ticket={selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)} />
      <FaqSheet open={faqOpen} onOpenChange={setFaqOpen} />
    </div>
  );
}
