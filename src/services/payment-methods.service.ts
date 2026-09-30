import { api } from './api';
import type {
  SavedPaymentMethod,
  AddPaymentMethodPayload,
  PaymentMethodsListResponse,
  PaymentMethodResponse,
  DefaultPaymentMethodResponse,
} from '@/types/payment-method.types';

// Shared, role-agnostic API — mounted at `/me/payment-methods` (NOT under `/agency`).
// The owner is resolved from the auth token. See api-doc/agency/payment-methods.md.
const BASE = '/me/payment-methods';

/** List all of the caller's saved methods (default first, then newest). */
export async function fetchPaymentMethods(): Promise<SavedPaymentMethod[]> {
  const res = await api.get<PaymentMethodsListResponse>(BASE);
  return res.data;
}

/** Get the caller's default method, or `null` if they have none. */
export async function fetchDefaultPaymentMethod(): Promise<SavedPaymentMethod | null> {
  const res = await api.get<DefaultPaymentMethodResponse>(`${BASE}/default`);
  return res.data;
}

/**
 * Save a mobile-money wallet: `{ provider, phoneNumber, label?, isDefault? }`.
 * Refused: a card, any old-shape key (`400`), a number on another network than
 * `provider` (`422 PAYMENT_PROVIDER_PHONE_MISMATCH`), an 11th method (`409`).
 */
export async function addPaymentMethod(
  payload: AddPaymentMethodPayload,
): Promise<SavedPaymentMethod> {
  const res = await api.post<PaymentMethodResponse>(BASE, payload);
  return res.data;
}

/** Mark a method as default (clears the previous default). */
export async function setDefaultPaymentMethod(id: string): Promise<SavedPaymentMethod> {
  const res = await api.patch<PaymentMethodResponse>(`${BASE}/${id}/default`);
  return res.data;
}

/** Permanently remove a method. */
export async function deletePaymentMethod(id: string): Promise<void> {
  await api.delete<{ success: boolean; message?: string }>(`${BASE}/${id}`);
}
