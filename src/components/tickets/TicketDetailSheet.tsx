import { useState } from 'react';
import { Send } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useTicketStore } from '@/store';
import type { Ticket, TicketPriority, TicketStatus } from '@/types';
import {
  STATUS_LABELS,
  STATUS_BADGE_CLASSES,
  PRIORITY_LABELS,
  TICKET_STATUSES,
  TICKET_TYPE_LABELS,
} from './ticket.constants';

interface TicketDetailSheetProps {
  ticket: Ticket | null;
  onOpenChange: (open: boolean) => void;
}

export function TicketDetailSheet({ ticket, onOpenChange }: TicketDetailSheetProps) {
  const { updateTicketStatus, updateTicketPriority, addNote } = useTicketStore();
  const [note, setNote] = useState('');

  if (!ticket) return null;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const handleAddNote = async () => {
    if (!note.trim()) return;
    await addNote(ticket.id, note);
    setNote('');
  };

  return (
    <Sheet open={!!ticket} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="pr-6">{ticket.subject}</SheetTitle>
        </SheetHeader>
        <div className="px-4 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn(STATUS_BADGE_CLASSES[ticket.status])}>
              {STATUS_LABELS[ticket.status]}
            </Badge>
            <Badge variant="secondary">{TICKET_TYPE_LABELS[ticket.type]}</Badge>
            <span className="text-xs text-muted-foreground">Opened {formatDate(ticket.createdAt)}</span>
          </div>

          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={ticket.status} onValueChange={(v) => updateTicketStatus(ticket.id, v as TicketStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              <Select value={ticket.priority} onValueChange={(v) => updateTicketPriority(ticket.id, v as TicketPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABELS) as TicketPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium">Notes</p>
            {ticket.notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet</p>
            ) : (
              <div className="space-y-3">
                {ticket.notes.map((n) => (
                  <div key={n.id} className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{n.author}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
                    </div>
                    <p className="text-sm">{n.content}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Textarea
                placeholder="Add a note..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="flex-1"
                rows={2}
              />
              <Button size="icon" onClick={handleAddNote} className="flex-shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
