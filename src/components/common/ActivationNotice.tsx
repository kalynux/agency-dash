// "Your account isn't active yet" — what that costs, and what fixes it.
//
// ─── Why this is a banner and not a gate ──────────────────────────────────────
//
// Since 2026-09-15 an agency activates ITSELF: `pending_verification` becomes
// `active` once it has a verified phone AND a display name, checked on the call
// that proves the phone (`POST /api/me/phone/verify/confirm`, or a confirmed
// contact change) and, since 2026-10-18, on every `PATCH /api/agency/profile`.
// Nobody else is involved. The store's `adoptProfile` folds that PATCH's
// `status` into the session, which is what takes this banner down. Before that date an administrator
// was the only route, which is why this dashboard never had anything to say
// here — there was no action to offer.
//
// ─── Why it matters more since 2026-10-18 ─────────────────────────────────────
//
// Vendors who search see only `active` agencies, and a vendor cannot publish
// physical products with one that is not active yet. So a pending agency is
// invisible to vendors, and a vendor who approves its request still cannot
// deliver through it. The dashboard itself stays usable — say that too, so this
// never reads as "you are blocked". See
// api-doc/agency/FRONTEND-CHANGELOG-connection-activation.md § 3.
//
// ⚠ **This is the ACTIVATION path, which is not the verification path.** Two
// different questions with two different answers (see `lib/account-standing.ts`):
// this banner is about `role_entity.status` and the remedy is the user's own
// phone and name. Being *verified* is an administrator's verdict, it gates cash
// rather than operation, and it lives on Account → Verification. Never merge the
// two into one "get approved" message — it would send someone to upload an ID
// card when all they had to do was enter a six-digit code.
//
// ⚠ Shown only for `pending_verification`. An `inactive` or `suspended` account
// is also not active, and proving a phone will not move it — an administrator
// put it there. Offering the code to them would be a lie, so
// `awaitingActivation` is what this reads, never `!activated`.

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, Circle, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAccountStanding } from '@/hooks/useAccountStanding';
import { cn } from '@/lib/utils';

/** Account → Profile, where the display name is edited. */
const DISPLAY_NAME_PATH = '/dashboard/account/profile';
/** Account → Security, where `ContactChangeCard` runs the WhatsApp code flow. */
const PHONE_VERIFICATION_PATH = '/dashboard/account/security';

const CARD_CLASS = 'py-0 border-gold-400/50 bg-gold-50/70 dark:border-gold-500/25 dark:bg-gold-500/10';

export interface ActivationNoticeProps {
  /**
   * During onboarding the Account pages are not reachable yet (the dashboard
   * routes require a finished onboarding), so the links would only bounce.
   * This variant says what is coming, without them.
   */
  variant?: 'dashboard' | 'onboarding';
}

export function ActivationNotice({ variant = 'dashboard' }: ActivationNoticeProps) {
  const { t } = useTranslation('account');
  const { awaitingActivation, phoneVerified, nameSet } = useAccountStanding();

  if (!awaitingActivation) return null;

  // Both fundamentals in place and still pending: the backend promotes on the
  // phone proof and on every profile save, so this is a session older than
  // either. Saying "verify your phone" to someone who just did would read as
  // broken, so that case gets the honest shrug instead, and no steps.
  const stuck = phoneVerified && nameSet;

  if (variant === 'onboarding') {
    if (stuck) return null;
    return (
      <Card className={cn(CARD_CLASS, 'mb-4')}>
        <CardContent className="flex items-start gap-3 p-3.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold-700 dark:text-gold-400" />
          <p className="text-sm text-gold-800 dark:text-gold-300">{t('activation.onboardingBody')}</p>
        </CardContent>
      </Card>
    );
  }

  // Either order activates (phone proof and profile save both run the check);
  // name first because it is the quicker of the two.
  const steps = [
    { key: 'name', done: nameSet, label: t('activation.steps.name'), cta: t('activation.nameCta'), to: DISPLAY_NAME_PATH },
    { key: 'phone', done: phoneVerified, label: t('activation.steps.phone'), cta: t('activation.cta'), to: PHONE_VERIFICATION_PATH },
  ];

  return (
    // `py-0`: the Card's own `py-6` stacks on the content's `p-4` and left a
    // tall empty band above and below a two-line banner.
    <Card className={CARD_CLASS}>
      <CardContent className="flex items-start gap-3 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-gold-700 dark:text-gold-400" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gold-800 dark:text-gold-300">
              {t('activation.title')}
            </p>
            <p className="text-sm text-muted-foreground">
              {stuck ? t('activation.bodyPhoneVerified') : t('activation.body')}
            </p>
          </div>
          {!stuck && (
            <ul className="space-y-1.5">
              {steps.map((step) => (
                <li key={step.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <span
                    className={cn(
                      'flex items-center gap-2 text-sm',
                      step.done ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success" aria-hidden />
                    ) : (
                      <Circle className="h-4 w-4 flex-shrink-0 text-gold-700 dark:text-gold-400" aria-hidden />
                    )}
                    <span className={cn(step.done && 'line-through')}>{step.label}</span>
                    {step.done && <span className="sr-only">({t('activation.stepDone')})</span>}
                  </span>
                  {!step.done && (
                    // 40px on a phone — the touch-target floor; `sm` is fine with a pointer.
                    <Button asChild size="sm" className="gap-2 max-md:h-10">
                      <Link to={step.to}>
                        {step.cta}
                        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                      </Link>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
