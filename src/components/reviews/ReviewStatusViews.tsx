/**
 * How a review's three statuses are shown, in one place.
 *
 * ⚠ **They are not three shades of one thing, so they are not one pill in three
 * colours.** A colour-only difference asks the reader to have learnt the legend,
 * and the three outcomes here are not on a scale — each is a different piece of
 * news:
 *
 *   published  it is live and counting towards the AGENT's rating
 *   pending    it is HELD, because prose was attached — not a failure, and
 *              nothing is required of the author
 *   rejected   a moderator declined it; it counts for nothing, its star
 *              included, and there is no appeal verb to offer
 *
 * So each carries its own icon, its own word, and its own sentence saying what
 * is happening. Three forms of the same table: `ReviewStatusMark` (icon + word,
 * for a cell or a card's badge), `ReviewStatusSentence` (the explanation as
 * inline flow, for a row that already has the mark above it) and
 * `ReviewStatusNote` (the panelled whole, where this is the only place the
 * review is seen).
 *
 * See api-doc/reviews.md § 3.
 */

import { useTranslation } from 'react-i18next';
import { BadgeCheck, Ban, Hourglass, Star, type LucideIcon } from 'lucide-react';

import { REVIEW_RATINGS, type ReviewStatus } from '@/types/review.types';
import { cn } from '@/lib/utils';

interface StatusStyle {
  icon: LucideIcon;
  /** Icon/word colour. */
  tone: string;
  /** Tinted panel behind the full note. */
  panel: string;
}

const STATUS_STYLES: Record<ReviewStatus, StatusStyle> = {
  published: {
    icon: BadgeCheck,
    tone: 'text-emerald-700 dark:text-emerald-400',
    panel: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40',
  },
  // Amber, never red. "Held" is the system working as designed — it is what
  // attaching prose buys you — and a destructive colour would read as a refusal.
  pending: {
    icon: Hourglass,
    tone: 'text-amber-700 dark:text-amber-400',
    panel: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
  },
  // Muted rather than destructive: nothing is broken and there is nothing to
  // fix, the row simply counts for nothing now.
  rejected: {
    icon: Ban,
    tone: 'text-muted-foreground',
    panel: 'border-border bg-muted/50',
  },
};

/** Read-only rating, as filled stars. The write path draws its own, interactive. */
export function ReviewStars({ rating, className }: { rating: number; className?: string }) {
  const { t } = useTranslation('shipments');
  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={t('review.ratingValue', { value: rating })}
    >
      {REVIEW_RATINGS.map((value) => (
        <Star
          key={value}
          aria-hidden
          className={cn(
            'h-3.5 w-3.5',
            value <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30',
          )}
        />
      ))}
    </span>
  );
}

/**
 * The one-line form — an icon and a word, for a table cell or a card's badge
 * slot. The word is short ("Held"); the sentence that explains it belongs to
 * {@link ReviewStatusNote} or to the line beneath the cell.
 */
export function ReviewStatusMark({
  status,
  className,
}: {
  status: ReviewStatus;
  className?: string;
}) {
  const { t } = useTranslation('shipments');
  const { icon: Icon, tone } = STATUS_STYLES[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', tone, className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {t(`review.status.${status}.badge` as 'review.status.pending.badge')}
    </span>
  );
}

/**
 * The explanation on its own, as **inline flow** — a `<span>`, so it is legal
 * inside the `<p>` a `RecordCard` renders its footnote in.
 *
 * Deliberately muted at every status rather than tinted like the mark above it:
 * a column of coloured paragraphs turns a list into a warning screen, and the
 * mark has already said which of the three this is.
 */
export function ReviewStatusSentence({
  status,
  className,
}: {
  status: ReviewStatus;
  className?: string;
}) {
  const { t } = useTranslation('shipments');
  return (
    <span className={cn('block text-xs leading-relaxed text-muted-foreground', className)}>
      {t(`review.status.${status}.body` as 'review.status.pending.body')}
    </span>
  );
}

/**
 * The full form — icon, heading and the sentence that says what is happening
 * and whether anything is expected of the author.
 *
 * Used on the shipment's own panel, where this is the only place the review is
 * ever seen, and as the mobile card's footnote.
 */
export function ReviewStatusNote({
  status,
  className,
}: {
  status: ReviewStatus;
  className?: string;
}) {
  const { t } = useTranslation('shipments');
  const { icon: Icon, tone, panel } = STATUS_STYLES[status];
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border p-3', panel, className)}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', tone)} aria-hidden />
      <div className="min-w-0 space-y-0.5">
        <p className={cn('text-sm font-medium', tone)}>
          {t(`review.status.${status}.title` as 'review.status.pending.title')}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t(`review.status.${status}.body` as 'review.status.pending.body')}
        </p>
      </div>
    </div>
  );
}
