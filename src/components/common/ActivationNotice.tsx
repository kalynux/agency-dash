// "Your account isn't active yet" — and the one thing that fixes it.
//
// ─── Why this is a banner and not a gate ──────────────────────────────────────
//
// Since 2026-09-15 an agency activates ITSELF: `pending_verification` becomes
// `active` on the call that proves a phone number (`POST /api/me/phone/verify/
// confirm`), and nobody else is involved. Before that date an administrator was
// the only route, which is why this dashboard never had anything to say here —
// there was no action to offer. Now there is exactly one, and it takes a minute.
//
// ⚠ **This is the ACTIVATION path, which is not the verification path.** Two
// different questions with two different answers (see `lib/account-standing.ts`):
// this banner is about `role_entity.status` and the remedy is the user's own
// phone. Being *verified* is an administrator's verdict, it gates cash rather
// than operation, and it lives on Account → Verification. Never merge the two
// into one "get approved" message — it would send someone to upload an ID card
// when all they had to do was enter a six-digit code.
//
// ⚠ Shown only for `pending_verification`. An `inactive` or `suspended` account
// is also not active, and proving a phone will not move it — an administrator
// put it there. Offering the code to them would be a lie, so
// `awaitingActivation` is what this reads, never `!activated`.

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAccountStanding } from '@/hooks/useAccountStanding';
import { cn } from '@/lib/utils';

/** Account → Security, where `ContactChangeCard` runs the WhatsApp code flow. */
const PHONE_VERIFICATION_PATH = '/dashboard/account/security';

export function ActivationNotice() {
  const { t } = useTranslation('account');
  const { awaitingActivation, phoneVerified } = useAccountStanding();

  if (!awaitingActivation) return null;

  return (
    <Card className="border-gold-400/50 bg-gold-50/70 dark:border-gold-500/25 dark:bg-gold-500/10">
      <CardContent className="flex flex-wrap items-start gap-3 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-gold-700 dark:text-gold-400" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-gold-800 dark:text-gold-300">
            {t('activation.title')}
          </p>
          {/* On a phone the explanation is hidden: squeezed beside the button it
              ran to a dozen lines, and the title plus "Verify my phone" already
              say what to do. The phone-already-verified case keeps it — there
              is no button there, so the sentence is all the card has to say. */}
          <p
            className={cn(
              'text-sm text-muted-foreground',
              !phoneVerified && 'max-md:hidden',
            )}
          >
            {/* A phone that is already verified but an account still pending is
                not a state the backend produces — it activates on that very
                call. Saying "verify your phone" to someone who just did would
                read as broken, so that case gets the honest shrug instead. */}
            {phoneVerified ? t('activation.bodyPhoneVerified') : t('activation.body')}
          </p>
        </div>
        {!phoneVerified && (
          <Button asChild size="sm" className="gap-2">
            <Link to={PHONE_VERIFICATION_PATH}>
              {t('activation.cta')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
