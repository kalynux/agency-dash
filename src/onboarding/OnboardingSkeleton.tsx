import { Skeleton } from '@/components/ui/skeleton';

export function OnboardingSkeleton() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <div className="h-16 border-b flex items-center justify-between px-4 md:px-8">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>

            <div className="flex-1 flex flex-col items-center px-4 py-8 md:py-12">
                {/* Progress bar */}
                <div className="w-full max-w-lg mb-8">
                    <div className="flex items-center justify-between mb-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-12" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                    <div className="flex justify-between mt-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex flex-col items-center gap-1">
                                <Skeleton className="h-8 w-8 rounded-full" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Card */}
                <div className="w-full max-w-lg space-y-6">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>

                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-10 w-full rounded-md" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sticky bottom CTA */}
            <div className="border-t px-4 py-4 md:hidden">
                <Skeleton className="h-12 w-full rounded-lg" />
            </div>
        </div>
    );
}
