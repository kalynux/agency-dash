/**
 * A review we have written, shown back to us.
 *
 * ⚠ **This is the only window an author has onto their own review.** There is no
 * public read of a delivery review, no edit verb and no delete verb, and a
 * second attempt at the same delivery is a terminal `409`. Without this block,
 * writing a review meant a success toast and then nothing — a row held for
 * moderation in particular had no representation anywhere in the UI.
 *
 * So it says all three things a reader needs and can act on none of: what was
 * written, when, and what became of it. No controls, because there are none to
 * offer — and the footnote says so rather than leaving the reader hunting for a
 * pencil icon.
 */

import { useTranslation } from 'react-i18next';

import { formatDate } from '@/lib/format';
import type { Review } from '@/types/review.types';
import { cn } from '@/lib/utils';
import { ReviewStars, ReviewStatusNote } from './ReviewStatusViews';

export function SubmittedReview({ review, className }: { review: Review; className?: string }) {
  const { t } = useTranslation(['shipments', 'common']);
  const hasProse = Boolean(review.title || review.body);

  return (
    <div className={cn('space-y-3 rounded-lg border p-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <ReviewStars rating={review.rating} />
        <span className="text-xs text-muted-foreground">
          {t('review.mine.written', { date: formatDate(review.createdAt) })}
        </span>
      </div>

      {hasProse ? (
        <div className="space-y-1">
          {review.title && <p className="text-sm font-medium">{review.title}</p>}
          {review.body && (
            <p className="whitespace-pre-line text-sm text-muted-foreground">{review.body}</p>
          )}
        </div>
      ) : (
        // Not an empty state: a bare rating is a complete review, and the one
        // that publishes immediately. Saying so explains the status beneath it.
        <p className="text-sm text-muted-foreground">{t('review.mine.ratingOnly')}</p>
      )}

      <ReviewStatusNote status={review.status} />

      <p className="text-xs text-muted-foreground">{t('review.mine.noChange')}</p>
    </div>
  );
}
