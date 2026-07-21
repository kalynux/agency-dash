import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { actorInitials, roleAvatarClass, roleLabel } from './ticket.constants';
import type { TicketActor } from '@/types/ticket.types';

interface ActorAvatarProps {
  actor: TicketActor | null;
  /** Fallback role when actor is null (e.g. unresolved reference). */
  role?: string;
  className?: string;
}

/** Avatar that shows the actor photo, falling back to role-tinted initials. */
export function ActorAvatar({ actor, role, className }: ActorAvatarProps) {
  const effectiveRole = actor?.role ?? role ?? 'agency';
  const name = actor?.name ?? roleLabel(effectiveRole);
  return (
    <Avatar className={cn('h-8 w-8', className)}>
      {actor?.avatar_url && <AvatarImage src={actor.avatar_url} alt={name} />}
      <AvatarFallback className={cn('text-xs font-medium', roleAvatarClass(effectiveRole))}>
        {actorInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
