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
 * **Phone** has two proofs, and the difference decides this whole half of the
 * card:
 *
 *   * a **WhatsApp connection on the number being claimed** — stronger, because
 *     a message actually arrived FROM that number, and it is the customer path;
 *   * a **six-digit code we send** (`/api/me/phone/verify/*`) — weaker, and the
 *     only one an agency can complete.
 *
 * An agency never registers through the bot, so it holds no connection,
 * `CONTACT_CHANGE_PHONE_UNPROVEN` is the only answer the connection confirm can
 * give it, and `phone_verified` could never become true at all. So the code is
 * what this card leads with, and the connection confirm survives as a one-line
 * shortcut for the account that happens to hold one.
 *
 * ⚠ **The number being verified is chosen server-side** — the pending one if a
 * change is in flight, otherwise the current one. `completesPendingChange` says
 * which, and it is the field the copy branches on: entering the code either
 * *moves* the sign-in identifier or merely proves the one already there.
 *
 * ⛔ Outside Meta's 24-hour service window the send currently fails on this
 * deployment (`PHONE_VERIFICATION_DELIVERY_FAILED`, measured 2026-09-14): only
 * an approved template may be sent there and the WABA holds none. The way out is
 * for the user to message the bot once, which opens the window — and which also
 * creates the connection the stronger proof wants, so one instruction serves
 * both paths.
 *
 * ⚠ A contact change does **not** sign other devices out. Only a password change
 * does. The copy says so, because a security screen implies otherwise.
 *
 * ─── This card ACTIVATES the account (2026-09-15) ─────────────────────────────
 *
 * `POST /api/me/phone/verify/confirm` is not only a contact-detail formality any
 * more: it is the call that promotes an agency from `pending_verification` to
 * `active`, and it is the ONLY thing that does. Administrative approval used to
 * be the only route; it no longer touches `status` at all.
 *
 * Two consequences live in `confirmCode` below: the copy says what the code is
 * worth while the account is still pending, and the session is refreshed after a
 * successful confirm so the Overview activation banner stops asking for
 * something that has already happened.
 *
 * ⛔ **Do not conflate this with verification.** An administrator's KYC verdict
 * is a different question with a different answer (`kyc_details.status`), it
 * gates cash rather than operation, and it lives on Account → Verification. See
 * lib/account-standing.ts.
 *
 * See api-doc/me/contact-change.md, api-doc/me/phone-verification.md and
 * api-doc/auth/README.md § Account activation.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AtSign,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Phone,
  ShieldCheck,
  X,
} from 'lucide-react';

import { SectionHeading } from '@/components/common/InfoHint';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/common/PhoneInput';
import { agencyProfileService } from '@/services/agency-profile.service';
import { contactService } from '@/services/contact.service';
import { phoneVerificationService } from '@/services/phone-verification.service';
import { useDefaultPhoneCountry } from '@/hooks/useDefaultPhoneCountry';
import { useAccountStanding } from '@/hooks/useAccountStanding';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/types/api';
import {
  CONTACT_CHANGE_PHONE_UNPROVEN,
  type ContactState,
} from '@/types/contact.types';
import {
  CODE_DESTROYING_ERRORS,
  PHONE_VERIFICATION_CODE_INVALID,
  PHONE_VERIFICATION_DELIVERY_FAILED,
  PHONE_VERIFICATION_RESEND_TOO_SOON,
  readAttemptsLeft,
  type PhoneVerificationRequestResult,
  type PhoneVerificationState,
} from '@/types/phone-verification.types';

type Channel = 'email' | 'phone';

/** The code is always six digits. */
const CODE_LENGTH = 6;

/**
 * `PHONE_VERIFY_RESEND_COOLDOWN_SECONDS`, as documented.
 *
 * The server owns this number and is the only authority on it — a refusal
 * carries the real remaining time in `retryAfterSeconds`, and that always wins.
 * This default exists only so the button is not offered for a round-trip that
 * can only be refused.
 */
const RESEND_COOLDOWN_SECONDS = 60;

export function ContactChangeCard() {
  const { t } = useTranslation(['account', 'common']);
  const defaultCountry = useDefaultPhoneCountry();
  // What proving the phone is worth right now — see the note beside the hint below.
  const { awaitingActivation } = useAccountStanding();
  const { refreshSession } = useOnboarding();

  const [state, setState] = useState<ContactState | null>(null);
  /** `GET /me/phone/verify` — what is verifiable, and whether a code is live. */
  const [verify, setVerify] = useState<PhoneVerificationState | null>(null);
  /** `phone_verified` off the profile. `null` when that read failed — see `load`. */
  const [phoneVerified, setPhoneVerified] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /** Which field is being edited, if any. Only one at a time. */
  const [editing, setEditing] = useState<Channel | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<Channel | 'confirm' | 'send' | 'code' | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** True once the phone confirm has answered `PHONE_UNPROVEN` — routes to Connect. */
  const [needsConnection, setNeedsConnection] = useState(false);

  // ─── OTP state ──────────────────────────────────────────────────────────────
  /** The last code we sent, if this session sent one. */
  const [sent, setSent] = useState<PhoneVerificationRequestResult | null>(null);
  const [code, setCode] = useState('');
  /** `details.attemptsLeft` off the last wrong code. */
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  /** WhatsApp refused the send — the one refusal with a real remedy behind it. */
  const [deliveryFailed, setDeliveryFailed] = useState(false);
  const [cooldownEndsAt, setCooldownEndsAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [contact, verifyState, verified] = await Promise.all([
        contactService.get(),
        // Free and side-effect-free: it mints no code and spends no cooldown,
        // so it is safe on mount. `pending` can be a code sent from another
        // device, which is exactly the case a client would otherwise lose.
        phoneVerificationService.getState(),
        // Non-fatal on purpose. This only decides whether to OFFER verification;
        // offering it for a number that turns out to be verified costs a code,
        // whereas hiding it on a failed read hides the only way an agency has to
        // ever reach `phone_verified`.
        agencyProfileService
          .getProfile()
          .then((r) => r.data.phoneVerified)
          .catch(() => null),
      ]);
      setState(contact);
      setVerify(verifyState);
      setPhoneVerified(verified);
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Ticks only while a cooldown is actually running, and stops itself at zero.
  useEffect(() => {
    if (cooldownEndsAt <= Date.now()) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= cooldownEndsAt) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownEndsAt]);

  const cooldownLeft = Math.max(0, Math.ceil((cooldownEndsAt - now) / 1000));

  /** Forget anything about a code in flight. Used whenever the target changes. */
  const resetCode = () => {
    setSent(null);
    setCode('');
    setAttemptsLeft(null);
    setCodeError(null);
    setDeliveryFailed(false);
  };

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
      // The target just moved, so any code on screen was minted for the old one.
      if (channel === 'phone') resetCode();
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
      if (channel === 'phone') resetCode();
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
      resetCode();
      await load();
      toast.success(t('contact.phone.confirmed'));
    } catch (err) {
      // Not a failure — the next step, and for an agency it is the expected
      // answer rather than an edge case. Say what would make it work instead of
      // printing a sentence the user cannot act on from here.
      if (err instanceof ApiError && err.code === CONTACT_CHANGE_PHONE_UNPROVEN) {
        setNeedsConnection(true);
        return;
      }
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  /**
   * Send a code. The target is the server's to choose — the pending number if a
   * change is in flight, otherwise the current one — so nothing is passed.
   */
  const sendCode = async () => {
    setBusy('send');
    setCodeError(null);
    setDeliveryFailed(false);
    setAttemptsLeft(null);
    setNeedsConnection(false);
    try {
      const result = await phoneVerificationService.request();
      setSent(result);
      setCode('');
      setCooldownEndsAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      setNow(Date.now());
      toast.success(t('contact.phone.verify.sentToast', { phone: result.phoneMasked }));
    } catch (err) {
      if (err instanceof ApiError) {
        // The 502 with a remedy behind it: outside Meta's 24-hour window this
        // deployment has no approved template to send, and the fix is the user
        // messaging the bot once — which the notice below says.
        if (err.code === PHONE_VERIFICATION_DELIVERY_FAILED) setDeliveryFailed(true);
        // Honour the server's own countdown over our default.
        if (
          err.code === PHONE_VERIFICATION_RESEND_TOO_SOON &&
          err.retryAfterSeconds !== undefined
        ) {
          setCooldownEndsAt(Date.now() + err.retryAfterSeconds * 1000);
          setNow(Date.now());
        }
      }
      setCodeError(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  /**
   * Spend the code. **Only `code` is sent** — the number was fixed when the code
   * was minted, and naming it here is a 400 rather than a stripped field.
   */
  const confirmCode = async () => {
    setBusy('code');
    setCodeError(null);
    setError(null);
    try {
      const result = await phoneVerificationService.confirm(code.trim());
      resetCode();
      setCooldownEndsAt(0);
      await load();
      // ⚠ This is also the call that ACTIVATES the account — the server promotes
      // `pending_verification` to `active` on a proved phone. `load()` re-reads
      // the contact endpoints, which know nothing about `role_entity.status`, so
      // without this the activation banner on Overview would keep telling
      // someone to do the thing they just did. Best-effort by design: the
      // promotion has happened server-side either way.
      void refreshSession();
      // Two different things to say, and the server says which: the identifier
      // moved, or the number already on the account was proved in place.
      toast.success(
        result.changed
          ? t('contact.phone.verify.changedToast')
          : t('contact.phone.verify.verifiedToast'),
      );
    } catch (err) {
      setCodeError(getApiErrorMessage(err));
      if (err instanceof ApiError) {
        // Disclosed deliberately — it tells the holder of the real code that
        // they mistyped and how much room is left.
        setAttemptsLeft(
          err.code === PHONE_VERIFICATION_CODE_INVALID
            ? (readAttemptsLeft(err.details) ?? null)
            : null,
        );
        // Expired or out of attempts: the code is gone. Retyping it cannot work
        // and leaving it in the box invites exactly that, so clear it and put
        // the user back on "send a new one".
        if (CODE_DESTROYING_ERRORS.has(err.code)) {
          setSent(null);
          setCode('');
          setVerify((prev) => (prev ? { ...prev, pending: false, expiresAt: null } : prev));
        }
      }
    } finally {
      setBusy(null);
    }
  };

  // ─── What the phone half is currently asking for ────────────────────────────

  /** A code is live: one we sent, or one requested on another device. */
  const codeLive = !!sent || verify?.pending === true;
  /**
   * Whether entering the code MOVES the sign-in number or merely proves the one
   * already on the account. The server decides it, and the copy follows — this
   * is the field the doc singles out for exactly that.
   */
  const completesChange = verify?.completesPendingChange ?? !!state?.pendingPhone;
  const verifyTarget = sent?.phoneMasked ?? verify?.phoneMasked ?? null;
  const codeExpiresAt = sent?.expiresAt ?? verify?.expiresAt ?? null;
  const canConfirmCode = code.trim().length === CODE_LENGTH && busy !== 'code';
  /**
   * Offered whenever there is something left to prove. A `phoneVerified` of
   * `null` is a failed profile read and counts as unverified — see `load`.
   *
   * Hidden while the number is being retyped: whatever it currently asks to
   * prove is about to stop being the target.
   */
  const showVerify =
    !!state &&
    editing !== 'phone' &&
    (!!state.pendingPhone || (!!state.phone && phoneVerified !== true) || codeLive);

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
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      {state.phone ?? (
                        <span className="italic text-muted-foreground">{t('contact.none')}</span>
                      )}
                    </span>
                    {/* Only worth saying once it can actually be true. Until the
                        OTP path existed an agency could never reach it. */}
                    {phoneVerified === true && !state.pendingPhone && (
                      <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-600 dark:text-emerald-500">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t('contact.phone.verify.verified')}
                      </span>
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
                <PendingRow
                  target={state.pendingPhone.target}
                  expiresAt={state.pendingPhone.expiresAt}
                  hint={t('contact.phone.pendingHint')}
                  busy={busy === 'phone'}
                  onCancel={() => void cancel('phone')}
                  cancelLabel={t('contact.cancelChange')}
                />
              )}

              {/* ── Proving the number ─────────────────────────────────────
                  The code, not the connection, because an agency holds no
                  connection by construction. Which number this proves is the
                  server's choice, and `completesChange` is what it chose. */}
              {showVerify && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                      {completesChange
                        ? t('contact.phone.verify.titleChange')
                        : t('contact.phone.verify.titleCurrent')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {completesChange
                        ? t('contact.phone.verify.hintChange')
                        : t('contact.phone.verify.hintCurrent')}
                    </p>
                    {/* Since 2026-09-15 this code is not merely a contact-detail
                        formality: proving the phone is what promotes an agency
                        from `pending_verification` to `active`, and it is the
                        only thing that does. Worth saying on the one screen that
                        can do it — someone sent here by the activation banner
                        arrives wanting to know they are in the right place.

                        ⚠ Only for `pending_verification`. An `inactive` or
                        `suspended` account is not promoted by a proved phone,
                        so promising activation there would be a lie — which is
                        exactly the distinction `awaitingActivation` carries. */}
                    {awaitingActivation && (
                      <p className="mt-1 text-xs font-medium text-gold-700 dark:text-gold-400">
                        {t('contact.phone.verify.activatesAccount')}
                      </p>
                    )}
                  </div>

                  {codeLive ? (
                    <div className="space-y-2">
                      <form
                        className="flex items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (canConfirmCode) void confirmCode();
                        }}
                      >
                        {/* Digits only — the code is six of them, generated one
                            `randomInt(0, 10)` at a time — so stripping the rest
                            makes a pasted "123 456" work instead of failing. */}
                        <Input
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={CODE_LENGTH}
                          placeholder={t('contact.phone.verify.codePlaceholder')}
                          aria-label={t('contact.phone.verify.codeLabel')}
                          // No autofocus: a code left live from another device
                          // would yank the page to this card on every load of
                          // the Security tab.
                          className="font-mono tracking-widest"
                        />
                        <Button type="submit" size="sm" disabled={!canConfirmCode} className="gap-1.5">
                          {busy === 'code' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          {t('contact.phone.verify.submit')}
                        </Button>
                      </form>

                      <p className="text-xs text-muted-foreground">
                        {verifyTarget && t('contact.phone.verify.sentTo', { phone: verifyTarget })}
                        {codeExpiresAt &&
                          ` ${t('contact.expires', { when: formatDateTime(codeExpiresAt) })}`}
                        {/* Reported because it is the first thing support asks
                            when a code did not arrive. */}
                        {sent?.delivery === 'template' &&
                          ` ${t('contact.phone.verify.deliveryTemplate')}`}
                      </p>

                      {attemptsLeft !== null && (
                        <p className="text-xs text-warning">
                          {t('contact.phone.verify.attemptsLeft', { count: attemptsLeft })}
                        </p>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void sendCode()}
                        disabled={busy === 'send' || cooldownLeft > 0}
                        className="gap-1.5"
                      >
                        {busy === 'send' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {cooldownLeft > 0
                          ? t('contact.phone.verify.resendIn', { seconds: cooldownLeft })
                          : t('contact.phone.verify.resend')}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => void sendCode()}
                      disabled={busy === 'send' || cooldownLeft > 0}
                      className="gap-1.5"
                    >
                      {busy === 'send' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {cooldownLeft > 0
                        ? t('contact.phone.verify.resendIn', { seconds: cooldownLeft })
                        : t('contact.phone.verify.send')}
                    </Button>
                  )}

                  {codeError && <p className="text-xs text-destructive">{codeError}</p>}

                  {/* The 502 that is the current state of this deployment for
                      anyone outside the 24-hour window. Messaging the bot opens
                      that window — and creates the connection the shortcut below
                      wants — so one instruction serves both ways out. */}
                  {(deliveryFailed || needsConnection) && (
                    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      <p className="flex items-start gap-1.5">
                        <MessageCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                        {deliveryFailed
                          ? t('contact.phone.verify.deliveryFailed')
                          : t('contact.phone.unproven')}
                      </p>
                      <Link
                        to="/dashboard/settings/notifications"
                        className="inline-block font-medium underline"
                      >
                        {t('contact.phone.connectLink')}
                      </Link>
                    </div>
                  )}

                  {/* The stronger proof, kept as a shortcut rather than the way
                      through: it needs a WhatsApp connection on the number, which
                      an agency only has if it is also a customer. `NOT_PENDING`
                      is all it could answer with no change in flight, so it is
                      offered only when there is one. */}
                  {state.pendingPhone && (
                    <div className="border-t pt-2">
                      <p className="text-xs text-muted-foreground">
                        {t('contact.phone.verify.connectedAlready')}
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => void confirmPhone()}
                        disabled={busy === 'confirm'}
                        className="h-auto gap-1.5 p-0 text-xs"
                      >
                        {busy === 'confirm' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {t('contact.phone.confirm')}
                      </Button>
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
