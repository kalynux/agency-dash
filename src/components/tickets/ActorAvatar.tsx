import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { actorInitials, roleAvatarClass, roleLabel } from './ticket.constants';
import { actorName } from './ticket.rules';
import type { TicketActor } from '@/types/ticket.types';

interface ActorAvatarProps {
  actor: TicketActor | null;
  /** Fallback role when actor is null (e.g. unresolved reference, or support). */
  role?: string;
  /**
   * Name to draw the initials from when there is no actor — a support
   * administrator arrives as a snapshot with a name and no picture.
   */
  name?: string | null;
  className?: string;
}

/** Avatar that shows the actor photo, falling back to role-tinted initials. */
export function ActorAvatar({ actor, role, name, className }: ActorAvatarProps) {
  const effectiveRole = actor?.role ?? role ?? 'agency';
  const label = name?.trim() || actorName(actor) || roleLabel(effectiveRole);
  // `avatar` is a file object; its `url` is null for a file this session may
  // not fetch as a plain image, in which case the initials stand in.
  const src = actor?.avatar?.url;
  return (
    <Avatar className={cn('h-8 w-8', className)}>
      {src && <AvatarImage src={src} alt={label} />}
      <AvatarFallback className={cn('text-xs font-medium', roleAvatarClass(effectiveRole))}>
        {actorInitials(label)}
      </AvatarFallback>
    </Avatar>
  );
}
