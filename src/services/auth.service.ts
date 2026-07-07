import { api } from './api';
import type { AuthMeAgencyResponse } from '@/types/api';

export const authService = {
    /**
     * Restores session and returns full user + role_entity.
     * Backend re-issues fresh access/refresh cookies.
     * Use `role_entity.onboarding_step` for routing decisions.
     */
    getAuthMeAgency(): Promise<AuthMeAgencyResponse> {
        return api.get<AuthMeAgencyResponse>('/auth/auth-me/agency');
    },

    /**
     * Clears both auth cookies server-side.
     */
    logout(): Promise<void> {
        return api.post<void>('/auth/logout');
    },
};
