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
 * **Phone** is proved by a **six-digit WhatsApp code** (`/api/me/phone/verify/*`)
 * — the one proof every dashboard and the storefront use (2026-09-21). The older
 * connection proof (`POST /api/me/phone/confirm`) serves the bot surface only,
 * so this card no longer offers it.
 *
 * ⚠ `PATCH /api/me/phone` sends no code by itself, on purpose — so starting a
 * change here requests the code straight away, as the next call.
 *
 * ⚠ **The number being verified is chosen server-side** — the pending one if a
 * change is in flight, otherwise the current one. `completesPendingChange` says
 * which, and it is the field the copy branches on: entering the code either
 * *moves* the sign-in identifier or merely proves the one already there.
 *
 * ⛔ **`PHONE_VERIFICATION_DELIVERY_FAILED` is a temporary failure, shown with a
 * Resend button and — if it happens again — a way to reach support.** It is
 * NEVER an instruction to message the WhatsApp bot: the backend has already
 * tried free text and the approved template by then, and until 2026-09-21 that
 * advice actively made delivery fail. See phone-verification.types.ts.
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

import { useCallback, useEffect, useState, type ElementType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  AtSign,
  CheckCircle2,
  Clock3,
  Loader2,
  Pencil,
  Phone,
  RotateCw,
  ShieldCheck,
  X,
} from 'lucide-react';

import { FieldHint, FieldLabel, InfoHint, SectionHeading } from '@/components/common/InfoHint';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/common/PhoneInput';
import { agencyProfileService } from '@/services/agency-profile.service';
import { contactService } from '@/services/contact.service';
import { phoneVerificationService } from '@/services/phone-verification.service';
import { useDefaultPhoneCountry } from '@/hooks/useDefaultPhoneCountry';
import { useAccountStanding } from '@/hooks/useAccountStanding';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/types/api';
import type { ContactState } from '@/types/contact.types';
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
  const [busy, setBusy] = useState<Channel | 'send' | 'code' | 'resend' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ─── OTP state ──────────────────────────────────────────────────────────────
  /** The last code we sent, if this session sent one. */
  const [sent, setSent] = useState<PhoneVerificationRequestResult | null>(null);
  const [code, setCode] = useState('');
  /** `details.attemptsLeft` off the last wrong code. */
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  /**
   * Consecutive `PHONE_VERIFICATION_DELIVERY_FAILED` answers. The first is shown
   * as "try again in a minute"; from the second on, support is offered too — a
   * refusal on every route is a platform or Meta-side fault only they can read.
   */
  const [deliveryFailures, setDeliveryFailures] = useState(0);
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
    setDeliveryFailures(0);
  };

  const startEdit = (channel: Channel) => {
    setEditing(channel);
    setDraft('');
    setError(null);
  };

  const request = async (channel: Channel) => {
    setBusy(channel);
    setError(null);
    try {
      if (channel === 'email') await contactService.changeEmail({ email: draft.trim() });
      else await contactService.changePhone({ phone: draft.trim() });
    } catch (err) {
      setError(getApiErrorMessage(err));
      setBusy(null);
      return;
    }

    setEditing(null);
    setDraft('');
    if (channel === 'email') {
      await load();
      setBusy(null);
      toast.success(t('contact.email.requested'));
      return;
    }

    // The target just moved, so any code on screen was minted for the old one.
    resetCode();
    await load();
    setBusy(null);
    // `PATCH /me/phone` deliberately sends nothing — sending there would start
    // the resend cooldown and this call would then be refused with 429. So the
    // code is requested here, as the next step, and it goes to the NEW number.
    // `sendCode` reports its own success and failure.
    await sendCode();
  };

  const cancel = async (channel: Channel) => {
    setBusy(channel);
    setError(null);
    try {
      if (channel === 'email') await contactService.cancelEmailChange();
      else await contactService.cancelPhoneChange();
      if (channel === 'phone') resetCode();
      await load();
      toast.success(t('contact.cancelled'));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  /**
   * Re-request the pending address. A second request **supersedes** the first
   * (api-doc/me/contact-change.md), so this mints a fresh link and kills the
   * old one — exactly what "I never got the email" needs.
   */
  const resendEmailLink = async () => {
    const target = state?.pendingEmail?.target;
    if (!target) return;
    setBusy('resend');
    setError(null);
    try {
      await contactService.changeEmail({ email: target });
      await load();
      toast.success(t('contact.email.resent'));
    } catch (err) {
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
    setAttemptsLeft(null);
    try {
      const result = await phoneVerificationService.request();
      setSent(result);
      setCode('');
      setDeliveryFailures(0);
      setCooldownEndsAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      setNow(Date.now());
      toast.success(t('contact.phone.verify.sentToast', { phone: result.phoneMasked }));
    } catch (err) {
      // WhatsApp refused every route. Its own notice below says so and carries
      // the support link, so it does not also go through `codeError`. No
      // cooldown is set: a failed send is not stored, so the server has not
      // started one, and Resend is worth offering straight away.
      if (err instanceof ApiError && err.code === PHONE_VERIFICATION_DELIVERY_FAILED) {
        setDeliveryFailures((n) => n + 1);
        return;
      }
      setDeliveryFailures(0);
      // Honour the server's own countdown over our default.
      if (
        err instanceof ApiError &&
        err.code === PHONE_VERIFICATION_RESEND_TOO_SOON &&
        err.retryAfterSeconds !== undefined
      ) {
        setCooldownEndsAt(Date.now() + err.retryAfterSeconds * 1000);
        setNow(Date.now());
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

  /**
   * Where the code entry lives. When it completes a pending change it belongs
   * INSIDE that change's panel — one place that says what is changing, how to
   * finish it and how to back out — instead of a second box under it.
   */
  const verifyInPanel = completesChange && !!state?.pendingPhone;
  /** Any request in flight locks every other control on the card. */
  const locked = busy !== null;

  /** The WhatsApp code: send, type, resend. Rendered inside whichever panel owns it. */
  const verifyBody = (
    <div className="space-y-3">
      {codeLive ? (
        <>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              if (canConfirmCode) void confirmCode();
            }}
          >
            {/* Digits only — the code is six of them, generated one
                `randomInt(0, 10)` at a time — so stripping the rest makes a
                pasted "123 456" work instead of failing. */}
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              placeholder={t('contact.phone.verify.codePlaceholder')}
              aria-label={t('contact.phone.verify.codeLabel')}
              // No autofocus: a code left live from another device would yank
              // the page to this card on every load of the Security tab.
              // `indent` balances the trailing letter-spacing so the digits centre.
              className="h-12 bg-background text-center indent-[0.4em] font-mono text-xl tracking-[0.4em] sm:h-10 sm:w-48 sm:text-lg"
            />
            <Button
              type="submit"
              disabled={!canConfirmCode}
              className="h-11 w-full gap-1.5 sm:h-10 sm:w-auto"
            >
              {busy === 'code' && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('contact.phone.verify.submit')}
            </Button>
          </form>

          <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <p className="text-xs text-muted-foreground">
              {verifyTarget && t('contact.phone.verify.sentTo', { phone: verifyTarget })}
              {codeExpiresAt && ` ${t('contact.expires', { when: formatDateTime(codeExpiresAt) })}`}
              {/* Reported because it is the first thing support asks when a
                  code did not arrive. */}
              {sent?.delivery === 'template' && ` ${t('contact.phone.verify.deliveryTemplate')}`}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void sendCode()}
              disabled={locked || cooldownLeft > 0}
              className="-ml-3 shrink-0 gap-1.5 sm:ml-0"
            >
              {busy === 'send' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCw className="h-3.5 w-3.5" />
              )}
              {cooldownLeft > 0
                ? t('contact.phone.verify.resendIn', { seconds: cooldownLeft })
                : t('contact.phone.verify.resend')}
            </Button>
          </div>

          {attemptsLeft !== null && (
            <p className="text-xs text-warning">
              {t('contact.phone.verify.attemptsLeft', { count: attemptsLeft })}
            </p>
          )}
        </>
      ) : (
        <Button
          onClick={() => void sendCode()}
          disabled={locked || cooldownLeft > 0}
          className="h-11 w-full gap-1.5 sm:h-10 sm:w-auto"
        >
          {busy === 'send' && <Loader2 className="h-4 w-4 animate-spin" />}
          {cooldownLeft > 0
            ? t('contact.phone.verify.resendIn', { seconds: cooldownLeft })
            : deliveryFailures > 0
              ? t('common:actions.retry')
              : t('contact.phone.verify.send')}
        </Button>
      )}

      {codeError && <p className="text-xs text-destructive">{codeError}</p>}

      {/* WhatsApp refused every route — free text and the approved template.
          A temporary failure: the Resend button above is the primary action,
          support the secondary once it has happened twice. ⛔ Never "message
          our bot first": the backend has already done everything that could
          help. */}
      {deliveryFailures > 0 && (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <p className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            {t('contact.phone.verify.deliveryFailed')}
          </p>
          {deliveryFailures > 1 && (
            <Link
              to="/dashboard/tickets"
              state={{ create: true }}
              className="inline-block font-medium underline"
            >
              {t('contact.phone.verify.contactSupport')}
            </Link>
          )}
        </div>
      )}
    </div>
  );

  /** What the code proves, and — while the account is pending — what it unlocks. */
  const verifyHeading = (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        {completesChange
          ? t('contact.phone.verify.titleChange')
          : t('contact.phone.verify.titleCurrent')}
      </p>
      <p className="text-xs text-muted-foreground">
        {completesChange
          ? t('contact.phone.verify.hintChange')
          : t('contact.phone.verify.hintCurrent')}
      </p>
      {/* Since 2026-09-15 this code is not merely a contact-detail formality:
          proving the phone is what promotes an agency from
          `pending_verification` to `active`, and it is the only thing that
          does. Worth saying on the one screen that can do it — someone sent
          here by the activation banner arrives wanting to know they are in the
          right place.

          ⚠ Only for `pending_verification`. An `inactive` or `suspended`
          account is not promoted by a proved phone, so promising activation
          there would be a lie — which is exactly the distinction
          `awaitingActivation` carries. */}
      {awaitingActivation && (
        <p className="text-xs font-medium text-gold-700 dark:text-gold-400">
          {t('contact.phone.verify.activatesAccount')}
        </p>
      )}
    </div>
  );

  const changeButton = (channel: Channel) => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => startEdit(channel)}
      disabled={locked}
      // Icon-only on a phone: the label would squeeze the address into a
      // mid-word wrap. The name stays for screen readers.
      aria-label={t('contact.change')}
      className="size-9 gap-1.5 p-0 sm:h-8 sm:w-auto sm:px-2.5"
    >
      <Pencil className="h-3.5 w-3.5" />
      <span className="max-sm:sr-only">{t('contact.change')}</span>
    </Button>
  );

  return (
    <Card className={sectionSurfaceClass}>
      {/* No `short` copy exists for this section, so on a phone the whole
          description moves behind an ⓘ beside the title — together with the
          no-sign-out notice from the foot of the card (see there). */}
      <SectionHeading
        icon={AtSign}
        className="max-md:gap-0"
        title={
          <>
            {t('contact.title')}
            <InfoHint
              className="md:hidden"
              label={t('common:form.aboutSection', { title: t('contact.title') })}
            >
              {t('contact.description')}
              <span className="mt-2 block">{t('contact.noSignOutNotice')}</span>
            </InfoHint>
          </>
        }
        description={<span className="max-md:hidden">{t('contact.description')}</span>}
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
            <section className="space-y-3">
              <IdentifierRow
                icon={AtSign}
                label={t('contact.email.label')}
                value={state.email}
                emptyLabel={t('contact.none')}
                // While a change is pending its panel offers "use a different
                // address" instead — a second "Change" here would read as a
                // third, unrelated action.
                action={!state.pendingEmail && editing !== 'email' && changeButton('email')}
              />

              {state.pendingEmail && editing !== 'email' && (
                <PendingChangePanel
                  newLabel={t('contact.email.newLabel')}
                  target={state.pendingEmail.target}
                  expiresAt={state.pendingEmail.expiresAt}
                  hint={t('contact.email.pendingHint')}
                  locked={locked}
                  cancelBusy={busy === 'email'}
                  onCancel={() => void cancel('email')}
                  // Beside "waiting for the link" — the same place the phone
                  // panel offers "send a new code".
                  hintAction={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void resendEmailLink()}
                      disabled={locked}
                      className="-ml-3 gap-1.5"
                    >
                      {busy === 'resend' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCw className="h-3.5 w-3.5" />
                      )}
                      {t('contact.email.resendLink')}
                    </Button>
                  }
                  actions={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit('email')}
                      disabled={locked}
                      className={panelActionClass}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t('contact.pending.useAnotherEmail')}
                    </Button>
                  }
                />
              )}

              {editing === 'email' && (
                <EditPanel
                  onCancel={() => setEditing(null)}
                  onSubmit={() => void request('email')}
                  canSubmit={!!draft.trim() && !locked}
                  busy={busy === 'email'}
                  submitLabel={t('contact.email.submit')}
                >
                  <FieldLabel htmlFor="contact-email" hint={t('contact.email.hint')}>
                    {t('contact.email.newLabel')}
                  </FieldLabel>
                  <Input
                    id="contact-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t('contact.email.placeholder')}
                    className="h-11 bg-background sm:h-10"
                    autoFocus
                  />
                  <FieldHint>{t('contact.email.hint')}</FieldHint>
                </EditPanel>
              )}
            </section>

            {/* ── Phone ────────────────────────────────────────────────────── */}
            <section className="space-y-3 border-t pt-5">
              <IdentifierRow
                icon={Phone}
                label={t('contact.phone.label')}
                value={state.phone}
                emptyLabel={t('contact.none')}
                badge={
                  // Only worth saying once it can actually be true. Until the
                  // OTP path existed an agency could never reach it. A `null`
                  // (failed profile read) claims neither.
                  state.pendingPhone || !state.phone ? null : phoneVerified === true ? (
                    <Badge variant="success">
                      <CheckCircle2 />
                      {t('contact.phone.verify.verified')}
                    </Badge>
                  ) : phoneVerified === false ? (
                    <Badge className="border-transparent bg-warning/15 text-warning">
                      {t('contact.phone.verify.notVerified')}
                    </Badge>
                  ) : null
                }
                action={!state.pendingPhone && editing !== 'phone' && changeButton('phone')}
              />

              {state.pendingPhone && editing !== 'phone' && (
                <PendingChangePanel
                  newLabel={t('contact.phone.newLabel')}
                  target={state.pendingPhone.target}
                  expiresAt={state.pendingPhone.expiresAt}
                  // The code step below says the same thing, and says how.
                  hint={verifyInPanel && showVerify ? undefined : t('contact.phone.pendingHint')}
                  locked={locked}
                  cancelBusy={busy === 'phone'}
                  onCancel={() => void cancel('phone')}
                  actions={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit('phone')}
                      disabled={locked}
                      className={panelActionClass}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t('contact.pending.useAnotherPhone')}
                    </Button>
                  }
                >
                  {/* The WhatsApp code is the only proof a dashboard uses. Which
                      number it proves is the server's choice, and
                      `completesChange` is what it chose. */}
                  {verifyInPanel && showVerify && (
                    <div className="space-y-3">
                      {verifyHeading}
                      {verifyBody}
                    </div>
                  )}
                </PendingChangePanel>
              )}

              {/* Proving the number already on the account — no change involved,
                  so nothing to cancel. */}
              {showVerify && !verifyInPanel && (
                <div className="space-y-3 rounded-xl border bg-muted/30 p-3 sm:p-4">
                  {verifyHeading}
                  {verifyBody}
                </div>
              )}

              {editing === 'phone' && (
                <EditPanel
                  onCancel={() => setEditing(null)}
                  onSubmit={() => void request('phone')}
                  canSubmit={!!draft.trim() && !locked}
                  busy={busy === 'phone'}
                  submitLabel={t('contact.phone.submit')}
                >
                  <FieldLabel htmlFor="contact-phone" hint={t('contact.phone.hint')}>
                    {t('contact.phone.newLabel')}
                  </FieldLabel>
                  <PhoneInput
                    id="contact-phone"
                    value={draft}
                    onChange={setDraft}
                    defaultCountry={defaultCountry}
                  />
                  <FieldHint>{t('contact.phone.hint')}</FieldHint>
                </EditPanel>
              )}
            </section>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            {/* Said out loud because a security screen implies the opposite —
                inline from `md` up, and in the heading's ⓘ on a phone. */}
            <p className="text-xs text-muted-foreground max-md:hidden">{t('contact.noSignOutNotice')}</p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Footer buttons of a panel: full-width, thumb-sized and stacked on a phone,
 * inline and compact from `sm` up.
 */
const panelActionClass = 'h-10 w-full gap-1.5 sm:h-8 sm:w-auto';

/** One sign-in identifier: what it is, its value, its state, and how to change it. */
function IdentifierRow({
  icon: Icon,
  label,
  value,
  emptyLabel,
  badge,
  action,
}: {
  icon: ElementType;
  label: string;
  value: string | null | undefined;
  emptyLabel: string;
  badge?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-medium [overflow-wrap:anywhere]">
            {value ?? <span className="font-normal italic text-muted-foreground">{emptyLabel}</span>}
          </p>
          {badge}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * A change waiting on proof: the new value, when it lapses, whatever finishes
 * it (`children`), and — always visible, always labelled — the way out.
 */
function PendingChangePanel({
  newLabel,
  target,
  expiresAt,
  hint,
  hintAction,
  actions,
  locked,
  cancelBusy,
  onCancel,
  children,
}: {
  newLabel: string;
  target: string;
  expiresAt: string;
  hint?: string;
  /** A small follow-up to `hint` ("resend the link"), drawn right under it. */
  hintAction?: ReactNode;
  actions?: ReactNode;
  locked: boolean;
  cancelBusy: boolean;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation('account');
  return (
    <div className="overflow-hidden rounded-xl border border-warning/30 bg-warning/[0.06]">
      <div className="space-y-1 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Badge className="border-transparent bg-warning/15 text-warning">
            <Clock3 />
            {t('contact.pending.title')}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {t('contact.expires', { when: formatDateTime(expiresAt) })}
          </span>
        </div>
        <p className="pt-1.5 text-xs text-muted-foreground">{newLabel}</p>
        <p className="text-base font-semibold [overflow-wrap:anywhere]">{target}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {hintAction && <div className="pt-1">{hintAction}</div>}
      </div>

      {children && <div className="border-t border-warning/20 p-3 sm:p-4">{children}</div>}

      <div className="flex flex-col gap-2 border-t border-warning/20 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-4">
        {actions}
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={locked}
          className={cn(
            panelActionClass,
            'border-destructive/40 text-destructive hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive sm:ml-auto',
          )}
        >
          {cancelBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          {t('contact.cancelChange')}
        </Button>
      </div>
    </div>
  );
}

/** The inline "type the new value" form. A real `<form>`, so Enter submits. */
function EditPanel({
  onCancel,
  onSubmit,
  canSubmit,
  busy,
  submitLabel,
  children,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
  busy: boolean;
  submitLabel: string;
  children: ReactNode;
}) {
  const { t } = useTranslation('common');
  return (
    <form
      className="space-y-3 rounded-xl border bg-muted/30 p-3 sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      <div className="space-y-2">{children}</div>
      {/* Primary on top on a phone (thumb reach), on the right from `sm` up. */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="h-11 w-full sm:h-9 sm:w-auto"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={!canSubmit}
          className="h-11 w-full gap-1.5 sm:h-9 sm:w-auto"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
