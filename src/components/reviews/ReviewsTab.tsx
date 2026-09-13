/**
 * Every delivery review this agency has written — `GET /api/agency/reviews`.
 *
 * ─── Why this list exists at all ──────────────────────────────────────────────
 *
 * A bare star rating publishes immediately; **attaching any prose holds the
 * review for a moderator**. There is no edit verb, no delete verb, and no public
 * read of a delivery review. So before this screen an agency wrote a review, saw
 * a toast, and the review was invisible to them forever — a held row most of
 * all, which has no representation anywhere else in the product.
 *
 * ─── Where it lives ───────────────────────────────────────────────────────────
 *
 * A tab of Agents rather than a menu of its own: an agency's review is the
 * employer's supervision record of the agent who carried the parcel, and it
 * moves that agent's aggregate and never this agency's own.
 *
 * ─── What a row can and cannot say ────────────────────────────────────────────
 *
 * ⚠ The author projection carries `subjectId` — a **shipment id** — and nothing
 * else about the delivery. No tracking number, no agent, no date of the run. So
 * the delivery column is a link into Shipments (`?open=`, the deep-link
 * convention) rather than a raw ObjectId painted into a cell, and nothing here
 * invents a label the API did not send.
 *
 * See api-doc/reviews.md.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, ChevronLeft, ChevronRight, Hourglass, Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RecordCard, RecordCardList } from '@/components/common/RecordCard';
import {
  FilterOptionGroup,
  FilterSection,
  SearchFilterBar,
} from '@/components/common/SearchFilterBar';
import { AsyncBoundary, EmptyState, ListSkeleton } from '@/components/common/state-views';
import {
  compactCardClass,
  compactCardContentClass,
  listSurfaceClass,
} from '@/components/layout/PageContainer';
import { useResource } from '@/hooks/useResource';
import { reviewsService } from '@/services/reviews.service';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Review } from '@/types/review.types';
import { ReviewStars, ReviewStatusMark, ReviewStatusSentence } from './ReviewStatusViews';

const PAGE_LIMIT = 20;

const STATUS_FILTERS = ['all', 'pending', 'published', 'rejected'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

/** Where a review's delivery is read: the shipments list, with its sheet open. */
function deliveryPath(review: Review): string {
  return `/dashboard/shipments?open=${encodeURIComponent(review.subjectId)}`;
}

export function ReviewsTab() {
  const { t } = useTranslation(['shipments', 'common']);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('all');

  const resource = useResource(async () => {
    const list = await reviewsService.list({
      page,
      limit: PAGE_LIMIT,
      status: status === 'all' ? undefined : status,
    });
    // The held count drives the banner, and it must be the count across every
    // page rather than what happens to be on this one. Already in hand when the
    // list IS the held ones — no second round trip for an answer we have.
    const held =
      status === 'pending'
        ? list.meta.total
        : (await reviewsService.list({ status: 'pending', page: 1, limit: 1 })).meta.total;
    return { list, held };
  }, [page, status]);

  const reviews = resource.data?.list.data ?? [];
  const meta = resource.data?.list.meta;
  const held = resource.data?.held ?? 0;
  const isFiltered = status !== 'all';

  const changeStatus = (next: StatusFilter) => {
    setStatus(next);
    setPage(1);
  };

  /** The prose, or the honest statement that there is none. */
  const renderProse = (review: Review) => {
    if (!review.title && !review.body) {
      return <span className="text-sm text-muted-foreground">{t('review.rollup.ratingOnly')}</span>;
    }
    return (
      <div className="min-w-0 space-y-0.5">
        {review.title && <p className="truncate text-sm font-medium">{review.title}</p>}
        {review.body && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{review.body}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Said once, above the list, rather than once per row: a held review is
          the state nobody expects and the only one with a "no, really, there is
          nothing to do" to deliver. Hidden while the filter is already on it. */}
      {held > 0 && status !== 'pending' && (
        <Card className={cn(compactCardClass, 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30')}>
          {/* Stacks below `sm`: at 360px a sentence and a button sharing one
              row leaves the sentence about ten characters wide. */}
          <CardContent
            className={cn(compactCardContentClass, 'flex flex-col gap-3 sm:flex-row sm:items-start')}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Hourglass
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  {t('review.rollup.heldBanner', { count: held })}
                </p>
                <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300/90">
                  {t('review.rollup.heldBannerBody')}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 max-sm:w-full"
              onClick={() => changeStatus('pending')}
            >
              {t('review.rollup.heldBannerAction')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filter-only: `GET /agency/reviews` takes page, limit and status and
          nothing else — its query schema is `.strict()`, so a search box here
          would be a field that cannot narrow anything. */}
      <SearchFilterBar
        activeCount={isFiltered ? 1 : 0}
        onReset={() => changeStatus('all')}
        filterDescription={t('review.rollup.filterDescription')}
        resultCount={meta?.total}
        resultNounKey="common:nouns.review"
      >
        <FilterSection label={t('review.rollup.filterStatus')}>
          <FilterOptionGroup
            value={status}
            onChange={changeStatus}
            options={STATUS_FILTERS.map((value) => ({
              value,
              label: t(`review.rollup.statuses.${value}` as 'review.rollup.statuses.all'),
            }))}
          />
        </FilterSection>
      </SearchFilterBar>

      <AsyncBoundary
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={resource.refetch}
        isEmpty={reviews.length === 0}
        loadingState={<ListSkeleton rows={4} />}
        emptyState={
          <EmptyState
            icon={Star}
            title={isFiltered ? t('review.rollup.emptyFiltered') : t('review.rollup.empty')}
            description={
              isFiltered ? t('review.rollup.emptyFilteredBody') : t('review.rollup.emptyBody')
            }
            // A page that has emptied under the reader — reviews only ever
            // arrive, but a filter change can strand page 3 — leaves them on an
            // empty screen with the pager hidden behind this very branch. So
            // the way back is the empty state's own action.
            action={
              isFiltered ? (
                <Button variant="outline" onClick={() => changeStatus('all')}>
                  {t('review.rollup.clearFilter')}
                </Button>
              ) : page > 1 ? (
                <Button variant="outline" onClick={() => setPage(1)}>
                  {t('common:pagination.first')}
                </Button>
              ) : undefined
            }
          />
        }
      >
        <Card className={listSurfaceClass}>
          <CardContent className="p-0">
            {/* Mobile: one card per review. */}
            <RecordCardList>
              {reviews.map((review) => (
                <RecordCard
                  key={review.id}
                  title={<ReviewStars rating={review.rating} />}
                  badge={<ReviewStatusMark status={review.status} />}
                  meta={[
                    formatDate(review.createdAt),
                    <Link
                      key="delivery"
                      to={deliveryPath(review)}
                      className="inline-flex items-center gap-0.5 text-primary hover:underline"
                    >
                      {t('review.rollup.openDelivery')}
                      <ArrowUpRight className="h-3 w-3 rtl:-scale-x-100" aria-hidden />
                    </Link>,
                  ]}
                  // Inline flow only — `RecordCard` puts this inside a `<p>`.
                  note={
                    <>
                      {review.title && (
                        <span className="mb-0.5 block font-medium text-foreground">
                          {review.title}
                        </span>
                      )}
                      {review.body && <span className="block line-clamp-3">{review.body}</span>}
                      {!review.title && !review.body && (
                        <span className="block italic">{t('review.rollup.ratingOnly')}</span>
                      )}
                      <ReviewStatusSentence status={review.status} className="mt-1.5" />
                    </>
                  }
                />
              ))}
            </RecordCardList>

            {/* Desktop: the same rows as a table. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-4 text-start text-sm font-medium">
                      {t('review.rollup.table.rating')}
                    </th>
                    <th className="p-4 text-start text-sm font-medium">
                      {t('review.rollup.table.comments')}
                    </th>
                    <th className="p-4 text-start text-sm font-medium">
                      {t('review.rollup.table.status')}
                    </th>
                    <th className="p-4 text-start text-sm font-medium">
                      {t('review.rollup.table.submitted')}
                    </th>
                    <th className="p-4 text-end text-sm font-medium">
                      {t('review.rollup.table.delivery')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((review) => (
                    <tr key={review.id} className="border-b align-top transition-colors hover:bg-muted/50">
                      <td className="p-4">
                        <ReviewStars rating={review.rating} />
                      </td>
                      <td className="max-w-[24rem] p-4">{renderProse(review)}</td>
                      {/* Icon, word AND the sentence that goes with it — the
                          three outcomes are different news, not three colours. */}
                      <td className="max-w-[20rem] p-4">
                        <ReviewStatusMark status={review.status} />
                        <ReviewStatusSentence status={review.status} className="mt-1" />
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {formatDate(review.createdAt)}
                        {review.publishedAt && (
                          <div className="text-xs">
                            {t('review.rollup.liveSince', {
                              date: formatDate(review.publishedAt),
                            })}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-end">
                        <Button asChild variant="ghost" size="sm" className="gap-1">
                          <Link to={deliveryPath(review)}>
                            {t('review.rollup.openDelivery')}
                            <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t p-4">
                <p className="text-sm text-muted-foreground">
                  {t('common:pagination.pageOf', { page: meta.page, total: meta.totalPages })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    aria-label={t('common:pagination.previous')}
                  >
                    <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label={t('common:pagination.next')}
                  >
                    <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </AsyncBoundary>
    </div>
  );
}
