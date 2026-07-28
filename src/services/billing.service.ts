import { api } from './api';
import type {
  PricingPlan,
  CurrentPlanData,
  CreditPack,
  BillingSettings,
  TopupInitPayload,
  PlanPurchasePayload,
  PaymentInitResult,
  PaymentStatus,
  PlansResponse,
  CurrentPlanResponse,
  CreditBalanceResponse,
  CreditPacksResponse,
  TopupInitResponse,
  TopupVerifyResponse,
  PlanPurchaseInitResponse,
  PlanPurchaseVerifyResponse,
  BillingSettingsResponse,
} from '@/types/billing.types';

// Agency billing surface — same engine as the vendor's, under `/agency`.
// See api-doc/agency/billing.md.
const BASE = '/agency';

// Docs document `_id`, but the live API may return `id`. Normalize so the rest
// of the app can rely on `_id` being present.
function normalizeId<T extends { _id?: string; id?: string }>(item: T): T {
  return { ...item, _id: item._id ?? item.id ?? '' };
}

// ─── Plans ──────────────────────────────────────────────────────────────────────

export async function fetchPlans(): Promise<PricingPlan[]> {
  const res = await api.get<PlansResponse>(`${BASE}/plans`);
  return res.data.map(normalizeId);
}

export async function fetchCurrentPlan(): Promise<CurrentPlanData> {
  const res = await api.get<CurrentPlanResponse>(`${BASE}/plan`);
  return res.data;
}

// Purchase/top-up/ledger histories live in the unified transactions feed —
// see transactions.service.ts (`GET /agency/transactions`).

// ─── Credit wallet ────────────────────────────────────────────────────────────

export async function fetchCreditBalance(): Promise<number> {
  const res = await api.get<CreditBalanceResponse>(`${BASE}/credits`);
  return res.data.balance;
}

export async function fetchCreditPacks(): Promise<CreditPack[]> {
  const res = await api.get<CreditPacksResponse>(`${BASE}/credits/packs`);
  return res.data;
}

// ─── Billing settings ───────────────────────────────────────────────────────────

export async function fetchBillingSettings(): Promise<BillingSettings> {
  const res = await api.get<BillingSettingsResponse>(`${BASE}/settings`);
  return res.data;
}

export async function updateBillingSettings(
  notifyDaysBeforeExpiry: number,
): Promise<BillingSettings> {
  const res = await api.patch<BillingSettingsResponse>(`${BASE}/settings`, {
    notifyDaysBeforeExpiry,
  });
  return res.data;
}

// ─── Gateway-agnostic payment flows ─────────────────────────────────────────────
// Both top-up and plan purchase share an identical initiate→poll-verify lifecycle.
// These wrappers normalize the two endpoints to a single { id, status, instructions }
// shape so PaymentDialog can drive either without knowing which it is.

export async function initiateTopup(payload: TopupInitPayload): Promise<PaymentInitResult> {
  const res = await api.post<TopupInitResponse>(`${BASE}/credits/topups`, payload);
  const topup = normalizeId(res.data.topup);
  return { id: topup._id, status: topup.status, instructions: res.data.instructions };
}

export async function verifyTopup(id: string): Promise<{ status: PaymentStatus }> {
  const res = await api.post<TopupVerifyResponse>(`${BASE}/credits/topups/${id}/verify`);
  return { status: res.data.status };
}

export async function initiatePlanPurchase(
  planId: string,
  payload: PlanPurchasePayload,
): Promise<PaymentInitResult> {
  const res = await api.post<PlanPurchaseInitResponse>(`${BASE}/plans/${planId}/purchase`, payload);
  const purchase = normalizeId(res.data.purchase);
  return { id: purchase._id, status: purchase.status, instructions: res.data.instructions };
}

export async function verifyPlanPurchase(id: string): Promise<{ status: PaymentStatus }> {
  const res = await api.post<PlanPurchaseVerifyResponse>(`${BASE}/plan-purchases/${id}/verify`);
  return { status: res.data.purchase.status };
}
