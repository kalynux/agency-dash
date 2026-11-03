import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Copy, MessageCircle, Send, Share2 } from 'lucide-react';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { openExternal } from '@/platform/browser';
import { copyText } from '@/platform/clipboard';
import { linkEarns, type ReferralPartner } from '@/types/referral.types';

/**
 * The code and what to share it with.
 *
 * ⚠ `links.whatsappUrl` and `links.telegramUrl` open a chat WITH THE WI-MALL BOT,
 * with the code prefilled. They are what a partner hands to someone who will shop
 * through the chat. Opening them from a button here would have the partner message
 * the bot with their own code, so they are copied, and "share on WhatsApp" sends
 * `registerUrl` to a contact the partner picks.
 *
 * Any URL can be `null` when the server has no base configured for it, and each is
 * then simply absent. While the link earns nothing the code and link stay visible,
 * as the contract asks, but nothing here invites anyone to pass them on.
 */
export function ReferralShareCard({ partner }: { partner: ReferralPartner }) {
  const { t } = useTranslation(['account', 'common']);
  const canShare = linkEarns(partner);
  const registerUrl = partner.links?.registerUrl ?? null;
  const whatsappUrl = partner.links?.whatsappUrl ?? null;
  const telegramUrl = partner.links?.telegramUrl ?? null;
  const message = t('referrals.share.message');

  const copy = async (text: string) => {
    if (await copyText(text)) toast.success(t('common:actions.copied'));
    else toast.error(t('referrals.share.copyFailed'));
  };

  return (
    <Card className={sectionSurfaceClass}>
      <CardHeader className="max-md:px-0">
        <CardTitle>{t('referrals.share.title')}</CardTitle>
        <CardDescription>
          {canShare
            ? t('referrals.share.description')
            : partner.program.enabled
              ? t('referrals.share.inactive')
              : t('referrals.share.paused')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-md:px-0">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 md:p-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t('referrals.share.code')}</p>
            <p dir="ltr" className="break-all font-mono text-lg font-semibold tracking-wide">{partner.code}</p>
          </div>
          {canShare && partner.code && (
            <Button variant="outline" size="sm" className="gap-2 max-md:h-10" onClick={() => void copy(partner.code!)}>
              <Copy className="h-4 w-4" /> {t('common:actions.copy')}
            </Button>
          )}
        </div>

        {registerUrl && (
          <div className="space-y-3">
            <LinkRow
              label={t('referrals.share.registerLink')}
              hint={t('referrals.share.registerHint')}
              url={registerUrl}
              onCopy={canShare ? copy : undefined}
            />
            {canShare && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 max-md:h-10"
                  onClick={() => void openExternal(`https://wa.me/?text=${encodeURIComponent(`${message} ${registerUrl}`)}`)}
                >
                  <MessageCircle className="h-4 w-4" /> {t('referrals.share.onWhatsapp')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 max-md:h-10"
                  onClick={() =>
                    void openExternal(
                      `https://t.me/share/url?url=${encodeURIComponent(registerUrl)}&text=${encodeURIComponent(message)}`,
                    )
                  }
                >
                  <Send className="h-4 w-4" /> {t('referrals.share.onTelegram')}
                </Button>
                {/* The phone's own share sheet, where the browser has one. */}
                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 max-md:h-10"
                    // A rejection here is the person closing the sheet.
                    onClick={() => void navigator.share({ text: message, url: registerUrl }).catch(() => undefined)}
                  >
                    <Share2 className="h-4 w-4" /> {t('referrals.share.more')}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {canShare && (whatsappUrl || telegramUrl) && (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">{t('referrals.share.chatLead')}</p>
            {whatsappUrl && <LinkRow label={t('referrals.share.whatsappLink')} url={whatsappUrl} onCopy={copy} />}
            {telegramUrl && <LinkRow label={t('referrals.share.telegramLink')} url={telegramUrl} onCopy={copy} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LinkRow({ label, hint, url, onCopy }: {
  label: string;
  hint?: string;
  url: string;
  onCopy?: (url: string) => Promise<void>;
}) {
  const { t } = useTranslation('common');
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex items-center gap-2">
        <p dir="ltr" className="min-w-0 flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">{url}</p>
        {onCopy && (
          <Button
            variant="outline"
            size="icon"
            className="flex-shrink-0 max-md:size-10"
            aria-label={`${t('actions.copy')} — ${label}`}
            onClick={() => void onCopy(url)}
          >
            <Copy className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
