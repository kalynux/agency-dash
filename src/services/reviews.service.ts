// Reviews — `/api/agency/reviews`.
//
// An agency reviews a DELIVERY, never a product. See `review.types.ts` for what
// that means and why our own review never touches our own rating.
//
// See api-doc/reviews.md.

import { api } from './api';
import type {
  CreateReviewPayload,
  ListReviewsParams,
  ListReviewsResponse,
  ReviewEligibility,
  ReviewEligibilityResponse,
  ReviewResponse,
} from '@/types/review.types';

export const reviewsService = {
  /**
   * GET /agency/reviews/eligibility — may we review this delivery?
   *
   * **Call this before showing the form.** A `200` with `eligible: false` is the
   * expected negative answer, and `reason` carries the same code the write would
   * have raised — so the copy table that explains a refusal here also explains a
   * refusal there.
   */
  async eligibility(shipmentId: string): Promise<ReviewEligibility> {
    const params = new URLSearchParams({ subjectType: 'delivery', subjectId: shipmentId });
    const res = await api.get<ReviewEligibilityResponse>(
      `/agency/reviews/eligibility?${params.toString()}`,
    );
    return res.data;
  },

  /**
   * POST /agency/reviews — rate a delivery.
   *
   * `201`. The response's `status` says what happened: `published` for a bare
   * rating, `pending` when any prose was attached, because prose is held for a
   * moderator and a number is not. Render the two differently.
   *
   * There is **no edit and no delete verb**, and one review per author per
   * subject is enforced by a unique index — a second attempt is
   * `409 REVIEW_ALREADY_EXISTS`, which is terminal.
   */
  create(payload: CreateReviewPayload): Promise<ReviewResponse> {
    return api.post<ReviewResponse>('/agency/reviews', payload);
  },

  /**
   * GET /agency/reviews — our own reviews, **every status**.
   *
   * Including a row still held for moderation, which is the only place its
   * existence is visible to its author.
   */
  list(params: ListReviewsParams = {}): Promise<ListReviewsResponse> {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.status) query.set('status', params.status);
    const qs = query.toString();
    return api.get<ListReviewsResponse>(`/agency/reviews${qs ? `?${qs}` : ''}`);
  },
};
