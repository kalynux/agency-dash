import { Mail, Phone, CheckCircle2, AlertCircle, LogOut, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useActionRunner } from '@/hooks/useActionRunner';
import { authService } from '@/services/auth.service';
import { whatsappService } from '@/services/channels.service';
import { useOnboarding } from '@/onboarding/store/onboarding.store';

function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <Badge variant="outline" className="text-green-600 border-green-200 gap-1">
      <CheckCircle2 className="w-3 h-3" /> Verified
    </Badge>
  ) : (
    <Badge variant="outline" className="text-amber-600 border-amber-200 gap-1">
      <AlertCircle className="w-3 h-3" /> Unverified
    </Badge>
  );
}

export function SecuritySettings() {
  const { session, logout } = useOnboarding();
  const roleEntity = session?.role_entity;
  const { run, pendingKey } = useActionRunner();

  const sendEmail = () =>
    run('email', () => authService.sendEmailVerification(), { success: 'Verification email sent.' });

  const startWhatsapp = async () => {
    const result = await run('wa', () => whatsappService.requestVerification(false));
    if (result) window.open(result.data.wa_link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Account Verification</CardTitle>
          <CardDescription>Verify your contact channels to unlock full functionality</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email */}
          <div className="flex items-center justify-between p-4 border rounded-lg gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-primary/10 rounded-full flex-shrink-0"><Mail className="w-5 h-5 text-primary" /></div>
              <div className="min-w-0">
                <p className="font-medium">Email</p>
                <p className="text-sm text-muted-foreground truncate">{roleEntity?.email ?? 'No email on file'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <VerifiedBadge verified={!!roleEntity?.email_verified} />
              {!roleEntity?.email_verified && roleEntity?.email && (
                <Button variant="outline" size="sm" disabled={pendingKey === 'email'} onClick={sendEmail}>
                  {pendingKey === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send link'}
                </Button>
              )}
            </div>
          </div>

          {/* Phone (via WhatsApp) */}
          <div className="flex items-center justify-between p-4 border rounded-lg gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-primary/10 rounded-full flex-shrink-0"><Phone className="w-5 h-5 text-primary" /></div>
              <div className="min-w-0">
                <p className="font-medium">Phone (WhatsApp)</p>
                <p className="text-sm text-muted-foreground truncate">{roleEntity?.phone ?? 'No phone on file'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <VerifiedBadge verified={!!roleEntity?.phone_verified} />
              {!roleEntity?.phone_verified && (
                <Button variant="outline" size="sm" disabled={pendingKey === 'wa'} onClick={startWhatsapp}>
                  {pendingKey === 'wa' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                </Button>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Manage notification channels (Telegram / WhatsApp) under Settings → Notifications.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Sign out of this device</CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <Button variant="outline" className="gap-2 text-destructive" onClick={() => logout()}>
            <LogOut className="w-4 h-4" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
