import { api } from './api';
import type {
  DeliveryFeeProposalInboxParams,
  DeliveryFeeProposalInboxResponse,
} from '@/types/delivery-fee-proposal.types';

function buildQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

/**
 * api-doc/agency/shipments.md § Answering a fee the PAYER proposed. Approve /
 * reject are shipment-scoped and live on `shipmentsService`.
 */
export const deliveryFeeProposalsService = {
  /**
   * GET /agency/delivery-fee-proposals — fees the vendor or the customer proposed
   * on your shipments, across shipments. Every status unless `status` is given.
   */
  listInbox(params: DeliveryFeeProposalInboxParams = {}): Promise<DeliveryFeeProposalInboxResponse> {
    return api.get<DeliveryFeeProposalInboxResponse>(
      `/agency/delivery-fee-proposals${buildQueryString(params as Record<string, unknown>)}`,
    );
  },
};
