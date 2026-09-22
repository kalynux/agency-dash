import { Skeleton } from '@/components/ui/skeleton';

/**
 * What `OnboardingGuard` shows while the session loads.
 *
 * It mirrors `OnboardingLayout` box for box — header height and status-bar
 * inset, the four-node stepper band, the content column, the sticky mobile
 * CTA — so nothing jumps when the real screen replaces it. Keep the two in
 * step: a skeleton with one step too few, or a header 24px shorter than the
 * real one on an edge-to-edge phone, is exactly the jump this exists to avoid.
 */
export function OnboardingSkeleton() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header — same height and safe-area inset as the real one. */}
            <div className="h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-card border-b border-border flex items-center justify-between px-4 md:px-8 flex-shrink-0 shadow-sm">
                <div className="flex items-center gap-2.5">
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <div className="flex flex-col gap-1">
                        <Skeleton className="h-3.5 w-16" />
                        <Skeleton className="h-2.5 w-24" />
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <Skeleton className="h-9 w-14 rounded-md" />
                    <Skeleton className="h-9 w-9 sm:w-24 rounded-md" />
                </div>
            </div>

            {/* Stepper — four nodes, like STEPS in OnboardingLayout. */}
            <div className="bg-card border-b border-border">
                <div className="w-full flex items-center justify-center px-6 pt-5 pb-4">
                    <div className="flex items-center w-full max-w-sm">
                        {[1, 2, 3, 4].map((i, idx, all) => (
                            <div key={i} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                                    <Skeleton className="h-9 w-9 rounded-full" />
                                    {/* The real label is 10px text on a 15px line. */}
                                    <div className="flex h-[15px] items-center">
                                        <Skeleton className="h-2.5 w-12" />
                                    </div>
                                </div>
                                {idx < all.length - 1 && (
                                    <div className="flex-1 mx-2 mb-4">
                                        <Skeleton className="h-0.5 w-full rounded-full" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content — same column as the layout's `main`. */}
            <div className="flex-1">
                <div className="w-full max-w-xl mx-auto px-4 py-6 md:py-10">
                    <div className="md:bg-card md:rounded-2xl md:border md:border-border md:shadow-sm">
                        <div className="md:px-6 md:pt-6 pb-4 border-b border-border/60 space-y-2">
                            <Skeleton className="h-6 w-2/3" />
                            <Skeleton className="h-4 w-full" />
                        </div>
                        <div className="md:px-6 pt-5 pb-6 space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-11 w-full rounded-lg" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky mobile CTA — same padding and inset as the real bar. */}
            <div className="md:hidden sticky bottom-0 bg-card border-t border-border px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex-shrink-0">
                <Skeleton className="h-12 w-full rounded-xl" />
            </div>
        </div>
    );
}
