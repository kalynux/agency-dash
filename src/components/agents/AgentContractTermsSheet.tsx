import { useTranslation } from 'react-i18next';
import { Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/common/ResponsiveModal';
import { ContractOverview } from '@/components/agents/ContractOverview';
import { useAgencyCountry } from '@/hooks/useAgencyCountry';
import type { RosterEntry } from '@/types/agent.types';

/**
 * Read-only contract terms for one roster row — popup on desktop, bottom sheet
 * on a phone.
 *
 * The Connections counterpart of the terms icon on Browse: the agreement is
 * one tap from the list, without opening the full membership editor (tabs,
 * forms, status actions). "Manage" hands over to that editor for anything
 * that changes the contract.
 */
export function AgentContractTermsSheet({
  entry,
  open,
  onOpenChange,
  onManage,
}: {
  entry: RosterEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the membership editor for the same contract. */
  onManage: (entry: RosterEntry) => void;
}) {
  const { t } = useTranslation('agents');
  const country = useAgencyCountry();
  if (!entry) return null;

  const { membership, agent, cashHeld } = entry;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('connections.termsSheet.title')}
      description={t('connections.termsSheet.description', { name: agent.name })}
      desktopClassName="sm:max-w-xl"
      mobileClassName="h-auto max-h-[92dvh]"
      footerClassName="flex-col sm:flex-row"
      footer={
        <Button
          className="w-full gap-1.5"
          onClick={() => {
            onOpenChange(false);
            onManage(entry);
          }}
        >
          <Settings2 className="h-4 w-4" />
          {t('connections.termsSheet.manage')}
        </Button>
      }
    >
      <ContractOverview
        membership={membership}
        country={country}
        agentName={agent.name}
        agentVerified={agent.verified}
        cashHeld={cashHeld}
      />
    </ResponsiveModal>
  );
}
