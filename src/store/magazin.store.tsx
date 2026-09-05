import { createContext, useContext, type ReactNode } from 'react';
import { magazinService } from '@/services/magazin.service';
import { useResource, type Resource } from '@/hooks/useResource';
import type { AgencyMagazin } from '@/types/magazin.types';

// ─── The agency's business identity (name, logo, support contacts), fetched once
// per dashboard session. The magazin — not `session.role_entity` — is the source
// of truth for the business name and logo: the logo in particular only exists as
// a magazin file, so app chrome reading the session can never show it.
//
// Consumed by the sidebar's identity block and by the Account → Store editor,
// which writes back through `setData` so a rename or a new logo lands in the
// chrome immediately, without a refetch or a reload.

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
