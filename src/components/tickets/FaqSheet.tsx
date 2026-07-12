import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

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
    answer: 'Update the delivery status from the Deliveries page as soon as possible, and open a ticket if you need support coordinating with the vendor or customer.',
  },
];

interface FaqSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FaqSheet({ open, onOpenChange }: FaqSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Frequently Asked Questions</SheetTitle>
        </SheetHeader>
        <div className="px-4">
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
