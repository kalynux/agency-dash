import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * What {@link OnboardingErrorBoundary} renders after a crash.
 *
 * Its own file because an error boundary has to be a class, and classes can't
 * hold the `useTranslation` hook this copy needs.
 */
export function OnboardingErrorFallback({ onRetry }: { onRetry: () => void }) {
    const { t } = useTranslation(['onboarding', 'common']);
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-6">
                <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2">{t('errors.boundaryTitle')}</h1>
            <p className="text-muted-foreground mb-8 max-w-sm">{t('errors.boundaryDescription')}</p>
            <Button onClick={onRetry} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                {t('common:actions.retry')}
            </Button>
        </div>
    );
}
