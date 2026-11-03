import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Loader2, Send } from 'lucide-react';
import { LegalLink } from '@/components/common/LegalLink';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/** `ApplySchema.motivation` on the server. */
const MOTIVATION_MAX = 1000;

/**
 * Applying is accepting the Partner Terms, so the button stays disabled until the
 * box is ticked (unticked by default: consent is given, never presumed). The
 * request itself always says `termsAccepted: true`.
 */
export function ReferralApplicationCard({ isApplying, onApply }: {
  isApplying: boolean;
  onApply: (motivation: string) => Promise<void>;
}) {
  const { t } = useTranslation('account');
  const [accepted, setAccepted] = useState(false);
  const [motivation, setMotivation] = useState('');

  return (
    <Card className={sectionSurfaceClass}>
      <CardHeader className="max-md:px-0">
        <CardTitle>{t('referrals.apply.title')}</CardTitle>
        <CardDescription>{t('referrals.apply.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-md:px-0">
        <div className="space-y-1.5">
          <Label htmlFor="referral-motivation">{t('referrals.apply.motivation')}</Label>
          <Textarea
            id="referral-motivation"
            rows={3}
            maxLength={MOTIVATION_MAX}
            placeholder={t('referrals.apply.motivationPlaceholder')}
            value={motivation}
            onChange={(event) => setMotivation(event.target.value)}
          />
        </div>

        <div className="flex items-start gap-2.5">
          <Checkbox
            id="referral-terms"
            className="mt-0.5"
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(checked === true)}
          />
          <Label htmlFor="referral-terms" className="block text-sm font-normal leading-snug">
            <Trans
              ns="account"
              i18nKey="referrals.apply.acceptTerms"
              components={{ terms: <LegalLink doc="referralTerms" /> }}
            />
          </Label>
        </div>

        <Button
          className="gap-2"
          disabled={!accepted || isApplying}
          onClick={() => void onApply(motivation.trim())}
        >
          {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {isApplying ? t('referrals.apply.sending') : t('referrals.apply.submit')}
        </Button>
      </CardContent>
    </Card>
  );
}
