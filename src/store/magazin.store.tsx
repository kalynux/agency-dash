import { createContext, useContext, type ReactNode } from 'react';
import { magazinService } from '@/services/magazin.service';
import { useResource, type Resource } from '@/hooks/useResource';
import type { AgencyMagazin } from '@/types/magazin.types';

// ─── The agency's business identity (name, logo, support contacts), fetched once
// per dashboard session. The magazin — not `session.role_entity` — is the source
// of truth for the business name and logo: the logo in particular only exists as
// a magazin file, so app chrome reading the session can never show it.
//
// Consumed by the sidebar's identity block, the depot pickers and every other
// reader of `headquartersAddresses`. The Account → Store and Account → Locations
// editors write back through `setData`, so a rename, a new logo or a new depot
// (with its server `_id`) lands everywhere immediately, without a refetch or a
// reload. An editor must never keep a private copy of the magazin — its saves
// would then be invisible to everything else until a reload.

/** The magazin as a standard resource — same shape `useResource` hands back. */
export type MagazinState = Resource<AgencyMagazin>;

const MagazinContext = createContext<MagazinState | null>(null);

export function MagazinProvider({ children }: { children: ReactNode }) {
  const magazin = useResource(() => magazinService.getMagazin(), []);
  return <MagazinContext.Provider value={magazin}>{children}</MagazinContext.Provider>;
}

export function useMagazin(): MagazinState {
  const ctx = useContext(MagazinContext);
  if (!ctx) throw new Error('useMagazin must be used within a MagazinProvider');
  return ctx;
}
