import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useOnboarding } from '@/onboarding/store/onboarding.store';

/**
 * "Are you sure you want to sign out?"
 *
 * Shared by the two places that offer it — the desktop header's avatar menu and
 * the Account → Profile page header on mobile — so the wording, the destructive
 * styling and the confirm step cannot drift apart between them.
 *
 * The confirmation is not ceremony. On mobile especially, signing out is one
 * mis-tap away from the actions beside it, and getting back in means finding a
 * password on a phone keyboard.
 */
export function LogoutConfirmDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation(['nav', 'common']);
  const { logout } = useOnboarding();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('header.logoutConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('header.logoutConfirmDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common:actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => logout()}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {t('header.logoutConfirmAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
