/**
 * Selectable IANA timezones for the agency profile.
 *
 * Onboarding (`Step3Branding`) and Account → Profile (`ProfileSettings`) both
 * write `role_entity.timezone`, so they share this list. They must not diverge:
 * a zone offered during onboarding but missing here leaves the saved value
 * unmatched by any option and the Select renders its placeholder, which reads
 * as "no timezone set" even though one is stored.
 *
 * Labels stay untranslated by design — a city name plus a UTC offset
 * ("Douala (WAT, UTC+1)") carries no copy for a translator to localize.
 */

export interface TimezoneOption {
  /** IANA zone id — what the backend stores. */
  value: string;
  /** City plus offset, as shown in the picker. */
  label: string;
}

export const TIMEZONES: TimezoneOption[] = [
  { value: 'Africa/Douala', label: 'Douala (WAT, UTC+1)' },
  { value: 'Africa/Lagos', label: 'Lagos (WAT, UTC+1)' },
  { value: 'Africa/Abidjan', label: 'Abidjan (GMT, UTC+0)' },
  { value: 'Africa/Dakar', label: 'Dakar (GMT, UTC+0)' },
  { value: 'Africa/Accra', label: 'Accra (GMT, UTC+0)' },
  { value: 'Africa/Nairobi', label: 'Nairobi (EAT, UTC+3)' },
  { value: 'Africa/Dar_es_Salaam', label: 'Dar es Salaam (EAT, UTC+3)' },
  { value: 'Africa/Kampala', label: 'Kampala (EAT, UTC+3)' },
  { value: 'Africa/Kigali', label: 'Kigali (CAT, UTC+2)' },
  { value: 'Africa/Cairo', label: 'Cairo (EET, UTC+2)' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST, UTC+2)' },
  { value: 'Europe/Paris', label: 'Paris (CET, UTC+1)' },
  { value: 'Europe/London', label: 'London (GMT, UTC+0)' },
  { value: 'America/New_York', label: 'New York (EST, UTC-5)' },
];
