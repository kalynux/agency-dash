import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useIsMobile } from '@/hooks/use-mobile';
import { responsiveSheetProps } from './ticket.constants';

const FAQS = [
  {
    question: 'When are payouts processed?',
    answer: 'Payouts are processed on the 1st and 15th of every month for all completed deliveries, provided your payout method is verified.',
  },
  {
    question: 'How do I add or remove a coverage region?',
    answer: 'Go to Account → Business and update your coverage regions. Changes apply immediately to new delivery assignments.',
  },
  {
    question: 'Where can I update my pricing or return policies?',
    answer: 'Visit Settings → Policies to edit your pricing model, return handling, and damage policies at any time.',
  },
  {
    question: 'What do I do if a delivery is delayed?',
    answer: 'Update the delivery status from the Shipments page as soon as possible, and open a ticket if you need support coordinating with the vendor or customer.',
  },
];

interface FaqSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Frequently Asked Questions, shown as a right-side sheet on desktop and a
 * bottom sheet on mobile (matching CreateTicketSheet / TicketDetailSheet).
 */
export function FaqSheet({ open, onOpenChange }: FaqSheetProps) {
  const isMobile = useIsMobile();
  const sheet = responsiveSheetProps(isMobile);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={sheet.side} className={`flex flex-col p-0 ${sheet.className}`}>
        <SheetHeader className="border-b">
          <SheetTitle>Frequently Asked Questions</SheetTitle>
          <SheetDescription>
            Quick answers to common questions. Still stuck? Create a ticket.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-sm font-medium">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  );
}
