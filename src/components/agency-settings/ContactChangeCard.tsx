/**
 * Change the email address / phone number this account SIGNS IN WITH.
 *
 * ─── The rule the whole screen is shaped by ───────────────────────────────────
 *
 * **The identifier does not move until the change is proved.** Requesting one
 * writes a *pending* change and nothing else: the current value still signs in,
 * the new one does not. That is why this card always shows both — the live
 * identifier and, beside it, what is waiting on confirmation — instead of
 * optimistically showing the new value.
 *
 * The reason is worth knowing: a flow that wrote the new value immediately and
 * flagged it unverified would be unrecoverable from a typo, because the account
 * could no longer be signed into and the correction form is behind the sign-in.
 *
 * ─── Two different proofs, and only one of them is an inbox ───────────────────
 *
 * **Email** is proved by a link sent to the new address. That link lands on the
 * main Wi-Mall site, not here — the same boundary `/forgot-password` lives on —
 * so this card's job ends at "we sent it".
 *
 * **Phone** is proved by a **WhatsApp connection on the number being claimed**.
 * There is no OTP and there will not be one: the platform integrates no SMS
 * provider, and a WhatsApp message to a number that has not messaged the bot
 * would need a paid template. What exists instead is the inbound direction — a
 * connection exists only because a message arrived FROM that number and the
 * account holder redeemed the code while signed in, which is a stronger proof
 * than an OTP.
 *
 * So `CONTACT_CHANGE_PHONE_UNPROVEN` is not really an error: it is the next
 * step, and this card routes to it rather than just printing it.
 *
 * ⚠ A contact change does **not** sign other devices out. Only a password change
 * does. The copy says so, because a security screen implies otherwise.
 *
 * See api-doc/me/contact-change.md.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AtSign, Loader2, MessageCircle, Phone, X } from 'lucide-react';

import { SectionHeading } from '@/components/common/InfoHint';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/common/PhoneInput';
import { contactService } from '@/services/contact.service';
import { useDefaultPhoneCountry } from '@/hooks/useDefaultPhoneCountry';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/types/api';
import {
  CONTACT_CHANGE_PHONE_UNPROVEN,
  type ContactState,
} from '@/types/contact.types';

type Channel = 'email' | 'phone';

export function ContactChangeCard() {
  const { t } = useTranslation(['account', 'common']);
  const defaultCountry = useDefaultPhoneCountry();

  const [state, setState] = useState<ContactState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /** Which field is being edited, if any. Only one at a time. */
  const [editing, setEditing] = useState<Channel | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<Channel | 'confirm' | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** True once the phone confirm has answered `PHONE_UNPROVEN` — routes to Connect. */
  const [needsConnection, setNeedsConnection] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setState(await contactService.get());
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (channel: Channel) => {
    setEditing(channel);
    setDraft('');
    setError(null);
    setNeedsConnection(false);
  };

  const request = async (channel: Channel) => {
    setBusy(channel);
    setError(null);
    try {
      if (channel === 'email') await contactService.changeEmail({ email: draft.trim() });
      else await contactService.changePhone({ phone: draft.trim() });
      setEditing(null);
      setDraft('');
      await load();
      toast.success(
        channel === 'email' ? t('contact.email.requested') : t('contact.phone.requested'),
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (channel: Channel) => {
    setBusy(channel);
    setError(null);
    try {
      if (channel === 'email') await contactService.cancelEmailChange();
      else await contactService.cancelPhoneChange();
      setNeedsConnection(false);
      await load();
      toast.success(t('contact.cancelled'));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const confirmPhone = async () => {
    setBusy('confirm');
    setError(null);
    setNeedsConnection(false);
    try {
      await contactService.confirmPhone();
      await load();
      toast.success(t('contact.phone.confirmed'));
    } catch (err) {
      // Not a failure — the next step. The number is not connected on WhatsApp
      // yet, so send them to the screen that connects it rather than printing a
      // sentence they cannot act on from here.
      if (err instanceof ApiError && err.code === CONTACT_CHANGE_PHONE_UNPROVEN) {
        setNeedsConnection(true);
        return;
      }
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className={sectionSurfaceClass}>
      <SectionHeading
        icon={AtSign}
        title={t('contact.title')}
        description={t('contact.description')}
      />
      <CardContent className="space-y-5 max-md:px-0">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('common:states.loading')}
          </div>
        ) : loadError ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {t('common:actions.retry')}
            </Button>
          </div>
        ) : state ? (
          <>
            {/* ── Email ────────────────────────────────────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                    {state.email ?? (
                      <span className="italic text-muted-foreground">{t('contact.none')}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('contact.email.label')}</p>
                </div>
                {editing !== 'email' && (
                  <Button variant="outline" size="sm" onClick={() => startEdit('email')}>
                    {t('contact.change')}
                  </Button>
                )}
              </div>

              {state.pendingEmail && (
                <PendingRow
                  target={state.pendingEmail.target}
                  expiresAt={state.pendingEmail.expiresAt}
                  hint={t('contact.email.pendingHint')}
                  busy={busy === 'email'}
                  onCancel={() => void cancel('email')}
                  cancelLabel={t('contact.cancelChange')}
                />
              )}

              {editing === 'email' && (
                <div className="space-y-2 rounded-lg border p-3">
                  <Label htmlFor="contact-email">{t('contact.email.newLabel')}</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t('contact.email.placeholder')}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">{t('contact.email.hint')}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                      {t('common:actions.cancel')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void request('email')}
                      disabled={!draft.trim() || busy === 'email'}
                      className="gap-1.5"
                    >
                      {busy === 'email' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {t('contact.email.submit')}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Phone ────────────────────────────────────────────────────── */}
            <div className="space-y-2 border-t pt-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {state.phone ?? (
                      <span className="italic text-muted-foreground">{t('contact.none')}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('contact.phone.label')}</p>
                </div>
                {editing !== 'phone' && (
                  <Button variant="outline" size="sm" onClick={() => startEdit('phone')}>
                    {t('contact.change')}
                  </Button>
                )}
              </div>

              {state.pendingPhone && (
                <div className="space-y-2">
                  <PendingRow
                    target={state.pendingPhone.target}
                    expiresAt={state.pendingPhone.expiresAt}
                    hint={t('contact.phone.pendingHint')}
                    busy={busy === 'phone'}
                    onCancel={() => void cancel('phone')}
                    cancelLabel={t('contact.cancelChange')}
                  />

                  {/* The proof lives on the account, not in a code box — so the
                      only control here is "check whether it is proved yet". */}
                  <Button
                    size="sm"
                    onClick={() => void confirmPhone()}
                    disabled={busy === 'confirm'}
                    className="gap-1.5"
                  >
                    {busy === 'confirm' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {t('contact.phone.confirm')}
                  </Button>

                  {needsConnection && (
                    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      <p className="flex items-start gap-1.5">
                        <MessageCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                        {t('contact.phone.unproven')}
                      </p>
                      <Link
                        to="/dashboard/settings/notifications"
                        className="inline-block font-medium underline"
                      >
                        {t('contact.phone.connectLink')}
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {editing === 'phone' && (
                <div className="space-y-2 rounded-lg border p-3">
                  <Label htmlFor="contact-phone">{t('contact.phone.newLabel')}</Label>
                  <PhoneInput
                    id="contact-phone"
                    value={draft}
                    onChange={setDraft}
                    defaultCountry={defaultCountry}
                  />
                  <p className="text-xs text-muted-foreground">{t('contact.phone.hint')}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                      {t('common:actions.cancel')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void request('phone')}
                      disabled={!draft.trim() || busy === 'phone'}
                      className="gap-1.5"
                    >
                      {busy === 'phone' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {t('contact.phone.submit')}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {/* Said out loud because a security screen implies the opposite. */}
            <p className="text-xs text-muted-foreground">{t('contact.noSignOutNotice')}</p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** What is waiting on confirmation, and the one control that abandons it. */
function PendingRow({
  target,
  expiresAt,
  hint,
  busy,
  onCancel,
  cancelLabel,
}: {
  target: string;
  expiresAt: string;
  hint: string;
  busy: boolean;
  onCancel: () => void;
  cancelLabel: string;
}) {
  const { t } = useTranslation('account');
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-dashed p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{target}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('contact.expires', { when: formatDateTime(expiresAt) })}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0"
        onClick={onCancel}
        disabled={busy}
        aria-label={cancelLabel}
        title={cancelLabel}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
