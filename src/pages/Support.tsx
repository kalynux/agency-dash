import { HelpCircle, Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Support() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Help & Support</h1>
        <p className="text-muted-foreground">
          Get help with your account or contact our support team.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Contact Options */}
        <div className="bg-card rounded-lg border p-6 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Live Chat</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Chat with our support team in real-time.
            </p>
          </div>
          <Button className="w-full mt-auto">Start Chat</Button>
        </div>

        <div className="bg-card rounded-lg border p-6 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Email Support</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Get detailed answers via email.
            </p>
          </div>
          <Button variant="outline" className="w-full mt-auto">Send Email</Button>
        </div>

        <div className="bg-card rounded-lg border p-6 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <HelpCircle className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Knowledge Base</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Browse guides and documentation.
            </p>
          </div>
          <Button variant="outline" className="w-full mt-auto">Visit Knowledge Base</Button>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-6">Frequently Asked Questions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              q: "How do I update my payment method?",
              a: "Go to Settings > Billing to manage your payment methods and subscription plan."
            },
            {
              q: "Can I manage multiple stores?",
              a: "Yes, you can manage multiple stores from a single account. Use the store switcher in the top left."
            },
            {
              q: "How are shipping rates calculated?",
              a: "Shipping rates can be configured in Settings > Shipping per region or weight."
            },
            {
              q: "When do I get paid?",
              a: "Payouts are processed weekly. You can view your payout schedule in the Finance section."
            }
          ].map((faq, i) => (
            <div key={i} className="bg-muted/30 p-4 rounded-lg">
              <h4 className="font-medium mb-2">{faq.q}</h4>
              <p className="text-sm text-muted-foreground">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
