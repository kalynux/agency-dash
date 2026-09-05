import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AgentStatus } from '@/types/agent.types';

/** Colour per status; the label lives in `agents:agentStatus.*`, keyed by the enum. */
const STATUS_STYLE: Record<AgentStatus, { dot: string; className: string }> = {
  active: { dot: 'bg-green-500', className: 'border-green-500 text-green-600 bg-green-50' },
  inactive: { dot: 'bg-gray-400', className: 'border-gray-400 text-gray-600 bg-gray-50' },
  suspended: { dot: 'bg-red-500', className: 'border-red-500 text-red-600 bg-red-50' },
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const { t } = useTranslation('agents');
  const style = STATUS_STYLE[status];
  return (
    // No `capitalize`: casing belongs to the translation.
    <Badge variant="outline" className={cn(style.className)}>
      <span className={cn('w-2 h-2 rounded-full me-1.5', style.dot)} />
      {t(`agentStatus.${status}` as 'agentStatus.active')}
    </Badge>
  );
}
