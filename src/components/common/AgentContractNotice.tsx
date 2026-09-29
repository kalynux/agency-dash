// "You don't have an agent under contract yet" — shown until one exists.
//
// An agency delivers nothing by itself: every shipment is carried by an agent
// on a live contract. Until the first one is established the dashboard is an
// empty shell, so the Overview says so and points at the directory.
//
// ⚠ "Established" means `active`, `paused` or `suspended` — a relationship
// that exists, whatever its current standing. A `pending` contract is NOT one
// (nobody has accepted it yet), so it keeps the notice up with the "waiting on
// an answer" copy instead. Terminal rows are history and count for nothing.
//
// Renders nothing while the roster is loading or failed to load: saying "you
// have no agents" on the strength of an empty initial array would be a lie.

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAgentsRoster } from '@/store/agents.store';
import type { MembershipStatus } from '@/types/agent.types';

const ESTABLISHED: MembershipStatus[] = ['active', 'paused', 'suspended'];

export function AgentContractNotice() {
  const { t } = useTranslation('account');
  const { roster, isLoading, error } = useAgentsRoster();

  // `isLoading` also flips on every background poll; only the very first load
  // (an empty roster) should hide the card, or it would flicker every interval.
  if (error || (isLoading && roster.length === 0)) return null;
  if (roster.some((e) => ESTABLISHED.includes(e.membership.status))) return null;

  const hasPending = roster.some((e) => e.membership.status === 'pending');

  return (
    <Card className="py-0 border-info-500/30 bg-info-500/5 dark:border-info-500/25 dark:bg-info-500/10">
      <CardContent className="flex flex-wrap items-start gap-3 p-4">
        <Users className="mt-0.5 h-5 w-5 flex-shrink-0 text-info-600 dark:text-info-500" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{t('agentContract.title')}</p>
          <p className="text-sm text-muted-foreground max-md:hidden">
            {hasPending ? t('agentContract.bodyPending') : t('agentContract.body')}
          </p>
        </div>
        <Button asChild size="sm" variant={hasPending ? 'outline' : 'default'} className="gap-2">
          <Link to={hasPending ? '/dashboard/agents/connections' : '/dashboard/agents/browse'}>
            {hasPending ? t('agentContract.ctaPending') : t('agentContract.cta')}
            <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
