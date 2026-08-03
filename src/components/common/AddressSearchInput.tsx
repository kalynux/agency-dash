import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, LocateFixed, MapPin, Search, X } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { geoService } from '@/services/geo.service';
import { getApiErrorMessage } from '@/lib/errors';
import type { GeoAddress, GeoCandidate } from '@/types/geo.types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;

export interface AddressSearchInputProps {
  /** The currently-stored address, or `null` when nothing is picked yet. */
  value: GeoAddress | null;
  /**
   * Fired with the selected candidate. `raw_input` is filled in with the text the
   * user typed — the backend keeps it alongside the resolved address.
   */
  onSelect: (address: GeoAddress) => void;
  /** Fired when the user clears the current selection. Omit to hide the clear button. */
  onClear?: () => void;
  /** ISO-2 bias passed to the provider, e.g. "cm". Defaults to the platform bias. */
  country?: string;
  placeholder?: string;
  hasError?: boolean;
  disabled?: boolean;
  id?: string;
}

/**
 * Maps-style address picker over `GET /api/geo/search`, mirroring the vendor
 * dashboard's address search so both dashboards behave identically.
 *
 * Every address the backend stores must be a candidate the user actually
 * SELECTED here — a hand-typed street plus manual coordinates is rejected with
 * `400 ADDRESS_GEO_REQUIRED`. The picked candidate is also what the surrounding
 * form derives city / region / street from, so this is the only input the user
 * really has to fill.
 *
 * Geo is off the critical path: a provider outage renders inline as a hint and
 * leaves the rest of the form usable rather than blocking submission.
 */
export function AddressSearchInput({
  value,
  onSelect,
  onClear,
  country,
  placeholder,
  hasError,
  disabled,
  id,
}: AddressSearchInputProps) {
  const { t } = useTranslation('settings');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  // Guards against a slow earlier request overwriting a newer one's results.
  const requestSeq = useRef(0);

  const bias = country ? country.toLowerCase() : undefined;

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setHint(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setHint(null);
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      try {
        const found = await geoService.search(trimmed, { country: bias, limit: 6 });
        if (seq !== requestSeq.current) return;
        setResults(found);
        setOpen(true);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setResults([]);
        setHint(getApiErrorMessage(err));
      } finally {
        if (seq === requestSeq.current) setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, bias]);

  // Close the results dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const pick = useCallback(
    (candidate: GeoCandidate) => {
      // `raw_input` is what the user typed before picking — the backend stores it
      // verbatim alongside the resolved address.
      onSelect({ ...candidate, raw_input: query.trim() || candidate.formatted_address });
      setQuery('');
      setResults([]);
      setOpen(false);
    },
    [onSelect, query],
  );

  const useMyLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      toast.error(t('addressSearch.unsupported'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const candidate = await geoService.reverse(pos.coords.latitude, pos.coords.longitude);
          if (candidate) {
            onSelect({ ...candidate, raw_input: candidate.formatted_address });
            toast.success(t('addressSearch.filledFromLocation'));
          } else {
            toast.error(t('addressSearch.couldNotResolve'));
          }
        } catch (err) {
          toast.error(getApiErrorMessage(err));
        } finally {
          setLocating(false);
        }
      },
      () => {
        toast.error(t('addressSearch.permissionDenied'));
        setLocating(false);
      },
      { timeout: 10000 },
    );
  }, [onSelect, t]);

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          {isSearching ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : query ? (
            <button
              type="button"
              aria-label={t('addressSearch.clearSearch')}
              onClick={() => {
                setQuery('');
                setResults([]);
                setOpen(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <Input
            id={id}
            value={query}
            disabled={disabled}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder={placeholder ?? t('addressSearch.placeholder')}
            className={cn('h-10 pl-10 pr-9', hasError && 'border-destructive')}
            aria-invalid={hasError}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={useMyLocation}
          disabled={disabled || locating}
          title={t('addressSearch.myLocationTitle')}
          className="h-10 shrink-0 gap-1.5"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          <span className="hidden sm:inline">{t('addressSearch.myLocation')}</span>
        </Button>
      </div>

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-md">
          {results.map((candidate, index) => (
            <li key={`${candidate.provider_place_id ?? 'result'}-${index}`}>
              <button
                type="button"
                onClick={() => pick(candidate)}
                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block">{candidate.formatted_address}</span>
                  {(candidate.components.city || candidate.components.region) && (
                    <span className="block text-xs text-muted-foreground">
                      {[candidate.components.city, candidate.components.region]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !isSearching && !hint && query.trim().length >= MIN_QUERY_LENGTH && results.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('addressSearch.noMatches')}</p>
      )}

      {value && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/40">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm">{value.formatted_address}</p>
            <p className="text-[11px] text-muted-foreground">
              {t('addressSearch.pinnedAt', {
                lat: value.coordinates.coordinates[1].toFixed(4),
                lng: value.coordinates.coordinates[0].toFixed(4),
              })}
            </p>
          </div>
          {onClear && (
            <button
              type="button"
              aria-label={t('addressSearch.clearAddress')}
              disabled={disabled}
              onClick={onClear}
              className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
