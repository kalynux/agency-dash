import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ActorAvatar } from './ActorAvatar';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { roleLabel } from './ticket.constants';
import { actorName } from './ticket.rules';
import type { TicketActor } from '@/types/ticket.types';

interface FollowerSelectProps {
  followers: TicketActor[];
  /** The signed-in user — the author always sees their own private item. */
  excludeUserId?: string | null;
  value: string[];
  onChange: (userIds: string[]) => void;
  disabled?: boolean;
}

/**
 * Picks which followers may see a PRIVATE note/attachment — the vendor or one
 * of our agents on an order ticket, say. The list IS the ticket's `followers`:
 * the backend refuses (403) a recipient who does not follow the ticket.
 *
 * Per the API, admins are auto-included on private items and the author sees
 * their own, so neither is offered as an explicit viewer.
 */
export function FollowerSelect({ followers, excludeUserId, value, onChange, disabled }: FollowerSelectProps) {
  const { t } = useTranslation('tickets');
  const options = useMemo(
    () => followers.filter((f) => f.role !== 'admin' && f.user_id !== excludeUserId),
    [followers, excludeUserId],
  );
  const selected = useMemo(() => new Set(value), [value]);

  function toggle(userId: string) {
    const next = new Set(selected);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    onChange([...next]);
  }

  const label = value.length === 0
    ? t('followerSelect.everyone')
    : t('followerSelect.selected', { count: value.length });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || options.length === 0}
          className="h-8 justify-between gap-2 font-normal"
        >
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {options.length === 0 ? t('followerSelect.none') : label}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <p className="px-2 py-1.5 text-xs text-muted-foreground">{t('followerSelect.hint')}</p>
        <ul className="max-h-56 overflow-y-auto">
          {options.map((f) => {
            const checked = selected.has(f.user_id);
            return (
              <li key={f.user_id}>
                <button
                  type="button"
                  onClick={() => toggle(f.user_id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-accent"
                >
                  <ActorAvatar actor={f} className="h-6 w-6" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                      <span className="truncate">{actorName(f) ?? roleLabel(f.role)}</span>
                      <VerifiedBadge verified={f.verified} />
                    </span>
                    <span className="block text-xs text-muted-foreground">{roleLabel(f.role)}</span>
                  </span>
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border',
                      checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
