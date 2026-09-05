import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useActionRunner } from '@/hooks/useActionRunner';
import { codCashService } from '@/services/cod-cash.service';
import type { CodDiscrepancyType } from '@/types/cod-cash.types';

/**
 * Standardized COD cash-chain mutations (record / confirm / reject deposits,
 * declare remittances, raise discrepancies) — toast + central error mapping +
 * per-action loading key. Each call resolves to its typed result or `null`.
 */
export function useCodCashActions() {
  const { t } = useTranslation('cash');
  const { pendingKey, run, isPending } = useActionRunner();

  const recordDeposit = useCallback(
    (agentId: string, amount: number, note?: string) =>
      run('record-deposit', async () => (await codCashService.recordDeposit(agentId, amount, note)).data, {
        success: t('deposits.recorded'),
      }),
    [run, t],
  );

  const confirmDeposit = useCallback(
    (id: string) =>
      run(`confirm:${id}`, async () => (await codCashService.confirmDeposit(id)).data, {
        success: t('deposits.confirmed'),
      }),
    [run, t],
  );

  const rejectDeposit = useCallback(
    (id: string, reason: string) =>
      run(`reject:${id}`, async () => (await codCashService.rejectDeposit(id, reason)).data, {
        success: t('deposits.rejected'),
      }),
    [run, t],
  );

  const declareRemittance = useCallback(
    (amount: number, reference: string, note?: string) =>
      run('declare-remittance', async () => (await codCashService.declareRemittance(amount, reference, note)).data, {
        success: t('remittances.declared'),
      }),
    [run, t],
  );

  const raiseDiscrepancy = useCallback(
    (agentId: string, type: CodDiscrepancyType, amount?: number, note?: string) =>
      run('raise-discrepancy', async () => (await codCashService.raiseDiscrepancy(agentId, type, amount, note)).data, {
        success: t('discrepancies.raised'),
      }),
    [run, t],
  );

  return { pendingKey, isPending, recordDeposit, confirmDeposit, rejectDeposit, declareRemittance, raiseDiscrepancy };
}
