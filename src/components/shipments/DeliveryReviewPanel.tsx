/**
 * Rate a completed delivery.
 *
 * ─── What this actually does, and what it does not ────────────────────────────
 *
 * The rating is attributed **server-side to the agent who carried the parcel**
 * and feeds that agent's trust score — which, once the trust composite stops
 * being a shadow, influences how much COD cash they may carry. Nothing here
 * takes an agent id; the platform performs the attribution, and three roles
 * (customer, vendor, agency) rate the same shipment into three different
 * aggregates.
 *
 * ⚠ **It never moves this agency's own rating.** An agency rating itself is not
 * evidence of anything, so our public score comes from our *customers'* delivery
 * reviews instead. That makes this a management tool rather than a marketing
 * one, and the copy says so — otherwise an operator reasonably assumes five
 * stars here improves their own listing.
 *
 * ─── The moderation split, surfaced before it bites ───────────────────────────
 *
 * A bare star rating publishes immediately; **attaching any prose sends the
 * review to a moderator**. That is stated next to the text fields rather than
 * discovered from the response, because the delay is the surprising half.
 *
 * ─── Eligibility is asked, not guessed ────────────────────────────────────────
 *
 * `GET …/reviews/eligibility` answers `200` with `eligible: false` and a reason,
 * so the form is never shown to somebody who cannot submit it — and the reason
 * is the same error code the write would have raised, which is why one copy
 * table serves both.
 *
 * ─── After the write, the panel becomes the review's only home ────────────────
 *
 * ⚠ There is **no public read of a delivery review, no edit verb and no delete
 * verb**, and `REVIEW_ALREADY_EXISTS` is terminal. So once a review exists this
 * panel stops being a form and starts being the record: it shows what was
 * written and what became of it — a `pending` row above all, which the author
 * can see nowhere else. The fresh case renders straight from the `POST`
 * response; a review written in an earlier session is looked up (see
 * `reviewsService.findForDelivery`, and why that lookup is bounded).
 *
 * See api-doc/reviews.md.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowUpRight, Loader2, Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SubmittedReview } from '@/components/reviews/SubmittedReview';
import { reviewsService } from '@/services/reviews.service';
import { ApiError } from '@/types/api';
import { getApiErrorMessage } from '@/lib/errors';
import { canReviewDelivery } from '@/components/shipments/shipment-actions';
import { cn } from '@/lib/utils';
import {
  REVIEW_BODY_MAX,
  REVIEW_RATINGS,
  REVIEW_TITLE_MAX,
  type Review,
  type ReviewEligibility,
} from '@/types/review.types';
import type { ShipmentStatus } from '@/types/shipment.types';

/** Where the roll-up of every review this agency has written lives. */
const REVIEWS_ROLLUP_PATH = '/dashboard/agents/reviews';

type Phase = 'checking' | 'form' | 'ineligible' | 'mine';

export interface DeliveryReviewPanelProps {
  shipmentId: string;
  status: ShipmentStatus;
}

export function DeliveryReviewPanel({ shipmentId, status }: DeliveryReviewPanelProps) {
  const { t } = useTranslation(['shipments', 'common']);

  const [phase, setPhase] = useState<Phase>('checking');
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mine, setMine] = useState<Review | null>(null);
  const [isFindingMine, setIsFindingMine] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * "You have already reviewed this" is the one refusal with something to show
   * instead of a sentence, so it is the one that triggers the lookup. Every
   * other reason stays a sentence — there is nothing written to display.
   */
  const loadMine = useCallback(async () => {
    setPhase('mine');
    setIsFindingMine(true);
    try {
      setMine(await reviewsService.findForDelivery(shipmentId));
    } catch {
      // A failed lookup is not a failed review: fall through to the wording
      // that says it exists and points at the list, which is still true.
      setMine(null);
    } finally {
      setIsFindingMine(false);
    }
  }, [shipmentId]);

  const check = useCallback(async () => {
    setPhase('checking');
    setError(null);
    try {
      const result = await reviewsService.eligibility(shipmentId);
      setEligibility(result);
      if (result.eligible) {
        setPhase('form');
      } else if (result.reason === 'REVIEW_ALREADY_EXISTS') {
        await loadMine();
      } else {
        setPhase('ineligible');
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
      setPhase('ineligible');
    }
  }, [shipmentId, loadMine]);

  useEffect(() => {
    if (!canReviewDelivery(status)) return;
    void check();
  }, [status, check]);

  // Attaching prose is what holds the review — so the warning appears the moment
  // there is prose to hold, not after submitting.
  const hasProse = title.trim().length > 0 || body.trim().length > 0;

  const submit = async () => {
    if (rating === 0) return;
    setIsBusy(true);
    setError(null);
    try {
      const { data } = await reviewsService.create({
        subjectType: 'delivery',
        subjectId: shipmentId,
        rating,
        // Omitted rather than sent empty: the schema is `.strict()` and the mere
        // PRESENCE of either field is what routes the review to a moderator.
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(body.trim() ? { body: body.trim() } : {}),
      });
      // Straight from the response, so the row on screen is the row the server
      // stored — no re-read, and `status` says which of the two happened.
      setMine(data);
      setPhase('mine');
      toast.success(
        data.status === 'pending' ? t('review.submittedHeld') : t('review.submittedLive'),
      );
    } catch (err) {
      // Terminal — there is no edit verb, so a second attempt cannot succeed.
      // Show them the review they already wrote rather than only refusing.
      if (err instanceof ApiError && err.code === 'REVIEW_ALREADY_EXISTS') {
        setEligibility({ eligible: false, reason: 'REVIEW_ALREADY_EXISTS' });
        void loadMine();
        return;
      }
      setError(getApiErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  };

  if (!canReviewDelivery(status)) return null;

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {phase === 'mine' ? t('review.mine.title') : t('review.title')}
      </h3>

      {phase === 'checking' && (
        <div className="flex items-center justify-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common:states.loading')}
        </div>
      )}

      {phase === 'ineligible' && (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          {error ??
            // `reason` is a real error code, so it resolves through the same
            // catalogue every other backend failure does.
            (eligibility?.reason
              ? getApiErrorMessage(new ApiError(422, eligibility.reason, ''))
              : t('review.notEligible'))}
        </p>
      )}

      {phase === 'mine' &&
        (isFindingMine ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('review.mine.lookingUp')}
          </div>
        ) : mine ? (
          <SubmittedReview review={mine} />
        ) : (
          // The lookup is bounded, so an agency deep in its history can land
          // here. Say the true thing — it exists, it cannot be changed — and
          // point at the one place that lists every one of them.
          <div className="space-y-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <p>{t('review.mine.notFound')}</p>
            <Link
              to={REVIEWS_ROLLUP_PATH}
              className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
            >
              {t('review.mine.seeAll')}
              <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
            </Link>
          </div>
        ))}

      {phase === 'form' && (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">{t('review.explainer')}</p>

          <div className="flex items-center gap-1" role="radiogroup" aria-label={t('review.ratingLabel')}>
            {REVIEW_RATINGS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={t('review.ratingValue', { value })}
                onClick={() => setRating(value)}
                className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Star
                  className={cn(
                    'h-6 w-6 transition-colors',
                    value <= rating
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-muted-foreground/40',
                  )}
                />
              </button>
            ))}
          </div>

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={REVIEW_TITLE_MAX}
            placeholder={t('review.titlePlaceholder')}
            aria-label={t('review.titleLabel')}
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={REVIEW_BODY_MAX}
            rows={2}
            placeholder={t('review.bodyPlaceholder')}
            aria-label={t('review.bodyLabel')}
          />

          {/* The surprising half, said before it happens. */}
          {hasProse && (
            <p className="text-xs text-amber-700 dark:text-amber-400">{t('review.prosePending')}</p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            size="sm"
            onClick={submit}
            disabled={rating === 0 || isBusy}
            className="w-full gap-1.5"
          >
            {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('review.submit')}
          </Button>
        </div>
      )}
    </section>
  );
}
