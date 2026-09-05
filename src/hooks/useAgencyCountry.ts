import { useMemo } from 'react';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useMagazin } from '@/store/magazin.store';
import { DEFAULT_COUNTRY } from '@/lib/regions';

/**
 * The country whose region catalogue every picker in the dashboard offers.
 *
 * `role_entity.country` is the authority — set once during onboarding step 1,
 * immutable afterwards, and what the backend validates coverage against. But it
 * is `null` on every agency provisioned before that step existed, and a null
 * country used to mean "no catalogue", which dropped the agent-contract coverage
 * field back to a comma-separated TEXT box. That is the worst of both worlds:
 * free text is exactly what `normalizeContractRegions` was written to stop, and
 * a region typed by hand ("Douala", "Litoral") reads as covering nowhere, so the
 * assignment filter then quietly refuses the agent every shipment.
 *
 * So a missing country is inferred rather than surrendered to:
 *
 *  1. the profile's own `country`;
 *  2. the ISO-2 code of the first geocoded headquarters — the magazin's depots
 *     are pinned on the map, and a pin knows which country it is in;
 *  3. {@link DEFAULT_COUNTRY}, the one country `locations.json` ships regions
 *     for. Safe as a last resort precisely because the backend skips region
 *     validation for a country-less agency: the keys pass through untouched
 *     instead of coming back `400 CONTRACT_COVERAGE_REGION_INVALID`.
 *
 * A country we hold no regions for (any non-CM code, today) still yields an
 * empty catalogue downstream — callers must keep their free-text fallback for
 * it. This hook only stops a *blank* country from looking like an unknown one.
 *
 * Must be called under `<OnboardingProvider>` and `<MagazinProvider>`, i.e.
 * inside the dashboard.
 */
export function useAgencyCountry(): string {
  const { session } = useOnboarding();
  const { data: magazin } = useMagazin();

  const profileCountry = session?.role_entity?.country ?? null;
  const headquarters = magazin?.headquartersAddresses;

  return useMemo(() => {
    const declared = profileCountry?.trim();
    if (declared) return declared.toUpperCase();

    const pinned = headquarters
      ?.map((hq) => hq.geo?.components.country_code?.trim())
      .find((code): code is string => !!code);
    if (pinned) return pinned.toUpperCase();

    return DEFAULT_COUNTRY;
  }, [profileCountry, headquarters]);
}
