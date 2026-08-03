import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ActorAvatar } from './ActorAvatar';
import { roleLabel } from './ticket.constants';
import type { TicketActor } from '@/types/ticket.types';

interface FollowerSelectProps {
  followers: TicketActor[];
  value: string[];
  onChange: (userIds: string[]) => void;
  disabled?: boolean;
}

/**
 * Picks which followers may see a PRIVATE note/attachment. Per the API, admins
 * are auto-included on private items, so only **non-admin** followers are
 * offered as explicit viewers.
 */
export function FollowerSelect({ followers, value, onChange, disabled }: FollowerSelectProps) {
  const { t } = useTranslation('tickets');
  const options = useMemo(() => followers.filter((f) => f.role !== 'admin'), [followers]);
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
                    <span className="block truncate">{f.name}</span>
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
