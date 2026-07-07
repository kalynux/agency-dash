import { useState, useEffect, useCallback } from 'react';
import { Loader2, ChevronRight, Check, Building2, MapPin } from 'lucide-react';
import { toast } from 'sonner';

import { OnboardingLayout } from '@/onboarding/OnboardingLayout';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { onboardingService } from '@/services/onboarding.service';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, type DeliveryAgency } from '@/types/api';
import { cn } from '@/lib/utils';

// ─── Agency Card ──────────────────────────────────────────────────────────────

function AgencyCard({
    agency,
    selected,
    onSelect,
}: {
    agency: DeliveryAgency;
    selected: boolean;
    onSelect: () => void;
}) {
    const hq = agency.headquarters_addresses?.[0];

    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={cn(
                'w-full text-left rounded-xl border-2 p-4 transition-all duration-200',
                'hover:border-primary/50 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card',
            )}
        >
            <div className="flex items-start gap-3">
                {/* Logo or icon */}
                <div
                    className={cn(
                        'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden',
                        selected ? 'bg-primary/10' : 'bg-muted',
                    )}
                >
                    {agency.logo_url ? (
                        <img
                            src={agency.logo_url}
                            alt={agency.agency_name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <Building2
                            className={cn('w-6 h-6', selected ? 'text-primary' : 'text-muted-foreground')}
                        />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm truncate">{agency.agency_name}</p>
                        {selected && (
                            <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                                <Check className="w-3 h-3 text-primary-foreground" />
                            </div>
                        )}
                    </div>
                    {hq && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">
                                {hq.city}, {hq.country}
                            </span>
                        </p>
                    )}
                </div>
            </div>
        </button>
    );
}

// ─── Skeleton list ────────────────────────────────────────────────────────────

function AgencySkeleton() {
    return (
        <div className="space-y-3">
            {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border p-4 flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Step2DeliveryLinking() {
    const { submitStep, isSubmitting } = useOnboarding();

    const [agencies, setAgencies] = useState<DeliveryAgency[]>([]);
    const [loadingAgencies, setLoadingAgencies] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const loadAgencies = useCallback(async () => {
        setLoadingAgencies(true);
        setFetchError(null);
        try {
            const res = await onboardingService.listAgencies();
            const list = res.data ?? res.agencies ?? [];
            setAgencies(list);
        } catch (err) {
            setFetchError(
                err instanceof ApiError
                    ? err.message
                    : 'Failed to load delivery agencies. Please try again.',
            );
        } finally {
            setLoadingAgencies(false);
        }
    }, []);

    useEffect(() => {
        loadAgencies();
    }, [loadAgencies]);

    const handleSubmit = useCallback(async () => {
        if (!selectedId) return;
        setSubmitError(null);
        try {
            await submitStep({ step: 2, default_delivery_agency_id: selectedId });
            toast.success('Delivery agency linked!');
        } catch (err) {
            setSubmitError(
                err instanceof ApiError ? err.message : 'Submission failed. Please try again.',
            );
        }
    }, [selectedId, submitStep]);

    const ctaSlot = (
        <Button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedId || isSubmitting}
            className="w-full h-12 text-base font-semibold gap-2"
        >
            {isSubmitting ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Linking…
                </>
            ) : (
                <>
                    Continue
                    <ChevronRight className="w-4 h-4" />
                </>
            )}
        </Button>
    );

    return (
        <OnboardingLayout ctaSlot={ctaSlot} stepKey={2}>
            <div className="space-y-2 mb-8">
                <h1 className="text-2xl font-bold">Delivery Linking</h1>
                <p className="text-muted-foreground text-sm">
                    Choose the delivery agency that will handle your orders. You can
                    change this later in Settings.
                </p>
            </div>

            {submitError && (
                <div
                    role="alert"
                    className="mb-4 p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20"
                >
                    {submitError}
                </div>
            )}

            {fetchError ? (
                <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-4">{fetchError}</p>
                    <Button variant="outline" onClick={loadAgencies}>
                        Retry
                    </Button>
                </div>
            ) : loadingAgencies ? (
                <AgencySkeleton />
            ) : agencies.length === 0 ? (
                <div className="text-center py-12">
                    <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                        No delivery agencies are available in your area yet.
                    </p>
                </div>
            ) : (
                <div className="space-y-3" role="radiogroup" aria-label="Select delivery agency">
                    {agencies.map((agency) => (
                        <AgencyCard
                            key={agency._id}
                            agency={agency}
                            selected={selectedId === agency._id}
                            onSelect={() => setSelectedId(agency._id)}
                        />
                    ))}
                </div>
            )}
        </OnboardingLayout>
    );
}
