import { api } from './api';
import type { AuthMeAgencyResponse } from '@/types/api';

export const authService = {
    /**
     * Restores session and returns the API envelope containing user + role_entity.
     * Backend re-issues fresh access/refresh cookies.
     * Use `response.data.role_entity.onboarding_step` for routing decisions.
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

    /**
     * POST /auth/send-email-verification — email the current role entity a
     * verification link (valid 24h). userId/role are read from the JWT.
     */
    sendEmailVerification(): Promise<{ success: boolean; data: { message: string } }> {
        return api.post<{ success: boolean; data: { message: string } }>('/auth/send-email-verification');
    },

    /**
     * PATCH /me/password — shared, role-agnostic; the password lives on the
     * User record, so one call covers every role. 403 USER_INVALID_PASSWORD
     * when `oldPassword` is wrong.
     */
    changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
        return api.patch<{ success: boolean; message: string }>('/me/password', { oldPassword, newPassword });
    },
};
