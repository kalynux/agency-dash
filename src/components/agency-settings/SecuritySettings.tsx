import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Lock, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { authService } from '@/services/auth.service';
import { ApiError } from '@/types/api';
import { getApiErrorMessage } from '@/lib/errors';

// Mirrors the backend policy for PATCH /me/password (api-doc/me/password.md).
const passwordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(8, 'Must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
    confirmPassword: z.string(),
  })
  .refine(v => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export function SecuritySettings() {
  return (
    <div className="space-y-6">
      <ChangePasswordCard />

      {/* Not-yet-implemented security features, greyed out (no agency API for these). */}
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Two-Factor Authentication
            <Badge variant="outline" className="ml-1">Coming soon</Badge>
          </CardTitle>
          <CardDescription>Add an extra layer of security to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable 2FA</p>
              <p className="text-sm text-muted-foreground">
                Not available yet — this will be enabled in a future update.
              </p>
            </div>
            <Switch disabled aria-label="Enable two-factor authentication" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Change the account password via the shared PATCH /me/password endpoint. */
function ChangePasswordCard() {
  const [apiError, setApiError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: PasswordFormValues) => {
    setApiError(null);
    try {
      await authService.changePassword(values.oldPassword, values.newPassword);
      toast.success('Password updated successfully.');
      reset();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'USER_INVALID_PASSWORD') {
        setError('oldPassword', { message: getApiErrorMessage(err) });
      } else if (err instanceof ApiError && err.isValidation) {
        setApiError(err.firstFieldError() ?? getApiErrorMessage(err));
      } else {
        setApiError(getApiErrorMessage(err));
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Change Password
        </CardTitle>
        <CardDescription>Use a strong password you don't use anywhere else.</CardDescription>
      </CardHeader>
      <CardContent>
        {apiError && (
          <div role="alert" className="mb-4 p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-200">
            {apiError}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="old-password">Current password</Label>
            <Input id="old-password" type="password" autoComplete="current-password" {...register('oldPassword')} />
            {errors.oldPassword && <p className="text-xs text-red-500" role="alert">{errors.oldPassword.message}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" {...register('newPassword')} />
              {errors.newPassword && <p className="text-xs text-red-500" role="alert">{errors.newPassword.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="text-xs text-red-500" role="alert">{errors.confirmPassword.message}</p>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            At least 8 characters, with an uppercase letter, a lowercase letter, a number and a special character.
          </p>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Update Password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
