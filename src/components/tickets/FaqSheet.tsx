import { useTranslation } from 'react-i18next';
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

/** Display order. The copy lives under `tickets:faq.items.<key>.{question,answer}`. */
const FAQ_KEYS = ['payouts', 'coverage', 'policies', 'delay'] as const;

interface FaqSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Frequently Asked Questions, shown as a right-side sheet on desktop and a
 * bottom sheet on mobile (matching CreateTicketSheet / TicketDetailSheet).
 */
export function FaqSheet({ open, onOpenChange }: FaqSheetProps) {
  const { t } = useTranslation('tickets');
  const isMobile = useIsMobile();
  const sheet = responsiveSheetProps(isMobile);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={sheet.side} className={`flex flex-col p-0 ${sheet.className}`}>
        <SheetHeader className="border-b">
          <SheetTitle>{t('faq.title')}</SheetTitle>
          <SheetDescription>{t('faq.description')}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          <Accordion type="single" collapsible className="w-full">
            {FAQ_KEYS.map((key) => (
              <AccordionItem key={key} value={`faq-${key}`}>
                <AccordionTrigger className="text-start text-sm font-medium">
                  {t(`faq.items.${key}.question` as 'faq.items.payouts.question')}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {t(`faq.items.${key}.answer` as 'faq.items.payouts.answer')}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  );
}
