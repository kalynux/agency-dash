import { Component, type ErrorInfo, type ReactNode } from 'react';
import { OnboardingErrorFallback } from '@/onboarding/OnboardingErrorFallback';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class OnboardingErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // In production, forward to your error monitoring service here.
        console.error('[OnboardingErrorBoundary]', error, info.componentStack);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return <OnboardingErrorFallback onRetry={this.handleRetry} />;
        }

        return this.props.children;
    }
}
