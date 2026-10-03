import { useTranslation } from 'react-i18next';
import { Loader2, MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { regionLabel } from '@/components/agents/contractTerms';
import { useAgencyCountry } from '@/hooks/useAgencyCountry';
import type { CoverageRefusal } from '@/components/shipments/forceAssign';

export interface CoverageForcePromptProps {
  refusal: CoverageRefusal;
  /** The named agent, for the sentence. */
  agentName: string | null;
  /** A COD run: `force` also waives the agent's cash limit, so say so. */
  isCod: boolean;
  pending: boolean;
  onSendAnyway: () => void;
  onDismiss: () => void;
}

/**
 * The answer to `422 CONTRACT_COVERAGE_REGION_NOT_COVERED` on assign-agent and
 * reassign, shared by both: the delivery's region, the regions the agent's
 * contract lists, and "Send anyway" — the same request again with `force: true`.
 * Rendered inline rather than as a second modal so it also works inside the
 * reassign dialog.
 */
export function CoverageForcePrompt({
  refusal,
  agentName,
  isCod,
  pending,
  onSendAnyway,
  onDismiss,
}: CoverageForcePromptProps) {
  const { t } = useTranslation(['shipments', 'common']);
  const country = useAgencyCountry();

  const delivery = refusal.deliveryRegion
    ? regionLabel(refusal.deliveryRegion, country)
    : t('coverageForce.unknownRegion');
  const covered =
    refusal.coveredRegions.length > 0
      ? refusal.coveredRegions.map((r) => regionLabel(r, country)).join(', ')
      : t('coverageForce.unknownRegion');

  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <p className="flex items-start gap-2 text-sm font-medium">
        <MapPinOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
        {t('coverageForce.title', { name: agentName ?? t('assignment.unnamedAgent') })}
      </p>
      <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-amber-800 dark:text-amber-300">{t('coverageForce.deliveryRegion')}</dt>
        <dd className="font-medium">{delivery}</dd>
        <dt className="text-amber-800 dark:text-amber-300">{t('coverageForce.coveredRegions')}</dt>
        <dd className="font-medium">{covered}</dd>
      </dl>
      <p className="text-xs">{t('coverageForce.explainer')}</p>
      {isCod && <p className="text-xs">{t('coverageForce.codNote')}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss} disabled={pending}>
          {t('common:actions.cancel')}
        </Button>
        <Button type="button" size="sm" onClick={onSendAnyway} disabled={pending}>
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('coverageForce.sendAnyway')}
        </Button>
      </div>
    </div>
  );
}
