import { CreditCard, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function BillingTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing &amp; Subscription</CardTitle>
        <CardDescription>Manage your dashboard plan and payment methods</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-primary">Standard Plan</p>
              <p className="text-sm text-muted-foreground">Free — no monthly fee</p>
            </div>
            <Button variant="outline">View Plans</Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="font-medium">Payment Methods</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5" />
                <div>
                  <p className="font-medium">Visa ending in 4242</p>
                  <p className="text-sm text-muted-foreground">Expires 12/25</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline">Default</Badge>
                <Button variant="ghost" size="sm">Edit</Button>
              </div>
            </div>
          </div>
          <Button variant="outline" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Add Payment Method
          </Button>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="font-medium">Billing History</h4>
          <div className="space-y-2">
            {[
              { date: 'Mar 15, 2024', amount: 0, status: 'Paid' },
              { date: 'Feb 15, 2024', amount: 0, status: 'Paid' },
            ].map((invoice, index) => (
              <div key={index} className="flex items-center justify-between p-3 hover:bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{invoice.date}</p>
                  <p className="text-sm text-muted-foreground">Standard Plan</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">${invoice.amount}</span>
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {invoice.status}
                  </Badge>
                  <Button variant="ghost" size="sm">Download</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
