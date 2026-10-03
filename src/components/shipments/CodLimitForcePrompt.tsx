import { useTranslation } from 'react-i18next';
import { Banknote, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import type { CodLimitRefusal } from '@/components/shipments/forceAssign';

export interface CodLimitForcePromptProps {
  refusal: CodLimitRefusal;
  /** The named agent, for the sentence. */
  agentName: string | null;
  pending: boolean;
  onAssignAnyway: () => void;
  onDismiss: () => void;
}

/**
 * The answer to `422 COD_AGENT_EXPOSURE_EXCEEDED` on assign-agent and reassign:
 * the agent's cash, this shipment's cash and the limit that refused, then
 * "Assign anyway" — the same request again with `force: true`. Only this code
 * gets the button; KYC and trust refusals are never waived by `force`.
 * See api-doc/agency/assignment.md → "Forcing an offer".
 */
export function CodLimitForcePrompt({
  refusal,
  agentName,
  pending,
  onAssignAnyway,
  onDismiss,
}: CodLimitForcePromptProps) {
  const { t } = useTranslation(['shipments', 'common']);
  const money = (v: number | null) => (v === null ? t('common:values.notAvailable') : formatCurrency(v));

  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <p className="flex items-start gap-2 text-sm font-medium">
        <Banknote className="w-4 h-4 flex-shrink-0 mt-0.5" />
        {t('codLimitForce.title', { name: agentName ?? t('assignment.unnamedAgent') })}
      </p>
      <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-amber-800 dark:text-amber-300">{t('codLimitForce.currentExposure')}</dt>
        <dd className="font-medium">{money(refusal.currentExposure)}</dd>
        <dt className="text-amber-800 dark:text-amber-300">{t('codLimitForce.additionalAmount')}</dt>
        <dd className="font-medium">{money(refusal.additionalAmount)}</dd>
        <dt className="text-amber-800 dark:text-amber-300">{t('codLimitForce.effectiveLimit')}</dt>
        <dd className="font-medium">{money(refusal.effectiveLimit)}</dd>
      </dl>
      <p className="text-xs">
        {refusal.poolBinds ? t('codLimitForce.poolBinds') : t('codLimitForce.sliceBinds')}
      </p>
      <p className="text-xs">{t('codLimitForce.explainer')}</p>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss} disabled={pending}>
          {t('common:actions.cancel')}
        </Button>
        <Button type="button" size="sm" onClick={onAssignAnyway} disabled={pending}>
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('codLimitForce.assignAnyway')}
        </Button>
      </div>
    </div>
  );
}
