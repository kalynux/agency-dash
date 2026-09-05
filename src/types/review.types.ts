// Reviews — see api-doc/reviews.md.
//
// A review is a rating (1–5), optionally some prose, by one identified person,
// about one identified thing, moderated once.
//
// ─── What an AGENCY can review ────────────────────────────────────────────────
//
// **Deliveries only.** `/api/agency/reviews` accepts `subjectType: 'delivery'`
// and nothing else; a product review from here is `400 REVIEW_ROLE_NOT_ALLOWED`,
// because the product review is the buyer's.
//
// The `subjectId` of a delivery review is a **shipment id**.
//
// ─── The part that is easy to get wrong ───────────────────────────────────────
//
// A delivery review is **internal**. It is attributed server-side to the agent
// who carried the parcel and feeds that agent's trust score. There is no public
// endpoint that returns one and there will not be — only the aggregate leaves the
// platform, as an agency's service rating.
//
// ⚠ **Our review moves the AGENT's aggregate and never our own.** An agency
// rating itself is not evidence of anything, and its own directory score would
// then be self-reported. Our public rating comes from our *customers'* delivery
// reviews. So this is a management tool, not a marketing one, and the UI must not
// suggest otherwise.
//
// ⚠ **Nothing here takes an agent id.** The platform performs the attribution.
// Three roles rate the same shipment — customer, vendor, agency — and each lands
// in a different aggregate.

/** An agency can only ever send `delivery`. Kept as a union because the wire is shared. */
export type ReviewSubjectType = 'product' | 'delivery';

/**
 * `pending` → held for a moderator. `published` → live. `rejected` → counts for
 * nothing, its star included.
 *
 * **A review carrying free text is held; a bare star rating publishes
 * immediately.** A number cannot be abusive, defamatory or a link somewhere
 * else, and eligibility has already established the author was party to the
 * delivery — so there is nothing for a human to decide. Prose is where the risk
 * is. Render "published" and "submitted for review" differently: the response to
 * `POST` says which happened, in `status`.
 */
export type ReviewStatus = 'pending' | 'published' | 'rejected';

export interface Review {
  id: string;
  subjectType: ReviewSubjectType;
  /** For a delivery review, the **shipment** id. */
  subjectId: string;
  /** An integer 1–5. There is no half-star. */
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  publishedAt: string | null;
  createdAt: string;
}

/**
 * `POST /api/agency/reviews`.
 *
 * The schema is `.strict()` — an unknown key is a `400`. There is no
 * `authorRole` field to send: the author's role comes from the mount.
 *
 * ⚠ **Adding a `title` or `body` sends the review to a moderator.** A bare
 * rating publishes at once. Say so before the user types, not after.
 */
export interface CreateReviewPayload {
  subjectType: 'delivery';
  /** The shipment id. */
  subjectId: string;
  /** Integer 1–5. */
  rating: number;
  /** ≤120. Its mere presence holds the review for moderation. */
  title?: string;
  /** ≤2000. Same. */
  body?: string;
}

export interface ReviewResponse {
  success: true;
  data: Review;
  message?: string;
}

/**
 * `GET /api/agency/reviews/eligibility?subjectType=&subjectId=`.
 *
 * **A `200` with `eligible: false` is a successful answer**, not an error — this
 * is a question, and "no, and here is why" answers it. `reason` is the same error
 * code the write path would have raised, so one copy table serves both.
 */
export interface ReviewEligibility {
  eligible: boolean;
  /** e.g. `REVIEW_ALREADY_EXISTS`, `REVIEW_NOT_ELIGIBLE`, `REVIEW_SUBJECT_NOT_REVIEWABLE`. */
  reason?: string;
  existingReviewId?: string;
}

export interface ReviewEligibilityResponse {
  success: true;
  data: ReviewEligibility;
}

export interface ListReviewsParams {
  page?: number;
  limit?: number;
  status?: ReviewStatus;
}

export interface ListReviewsResponse {
  success: true;
  /** Our own reviews, **every status** — including a row still held for moderation. */
  data: Review[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/** The rating scale, for rendering a picker. Integers only. */
export const REVIEW_RATINGS = [1, 2, 3, 4, 5] as const;

/** ≤120 server-side. */
export const REVIEW_TITLE_MAX = 120;
/** ≤2000 server-side. */
export const REVIEW_BODY_MAX = 2000;
