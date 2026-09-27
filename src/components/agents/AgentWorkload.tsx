import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * "3 active · 1 for you". The first count is everything the agent carries for
 * every agency they serve — how busy they really are — and the second is the
 * part of it that is yours. Both come off the roster row and `/agents/eligible`.
 */
export function AgentWorkload({
  active,
  forYou,
  className,
}: {
  active: number;
  /** Absent on a payload from before 2026-09-27; then only the total is shown. */
  forYou: number | undefined;
  className?: string;
}) {
  const { t } = useTranslation('agents');
  return (
    <span className={cn('tabular-nums', className)} title={t('workload.hint')}>
      {typeof forYou === 'number'
        ? t('workload.summary', { active: formatNumber(active), forYou: formatNumber(forYou) })
        : formatNumber(active)}
    </span>
  );
}
