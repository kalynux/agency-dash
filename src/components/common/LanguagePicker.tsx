import { Check, Globe } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getLanguageDescriptor } from '@/i18n/config';
import type { LanguageCode } from '@/i18n/config';
import { useLanguage } from '@/i18n/useLanguage';
import { cn } from '@/lib/utils';

/**
 * A compact "which language is this app in?" control.
 *
 * Built for the screens that come *before* there is an account to read
 * `preferred_language` off — sign-in, registration, password reset. A packaged
 * app is downloaded by people whose device locale we have already guessed at
 * (`detectInitialLanguage()` in `src/i18n/index.ts` reads `navigator.language`),
 * but a guess is not an answer: a phone set to English in a French-speaking
 * market is common, and someone who cannot read the sign-in form has no way to
 * reach the Account → Profile picker that would fix it. This is that way.
 *
 * Deliberately not wired to the profile. `LanguageProvider.setLanguage` marks
 * the choice as user-made, which both persists it to `localStorage` and stops a
 * later `/auth/me` from yanking the UI back to the stored `preferred_language`
 * — so a pre-login pick survives the sign-in it was made for. Making it the
 * account's durable setting stays where it belongs, on Account → Profile.
 *
 * Every entry is written in its own language (`nativeName`), because a picker
 * you have to already understand in order to use is not a picker.
 */
export function LanguagePicker({ className }: { className?: string }) {
  const { language, languages, setLanguage } = useLanguage();
  const active = getLanguageDescriptor(language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1.5',
          'text-sm font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors',
          'hover:bg-accent hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          className,
        )}
        // Named rather than described: on these screens the control has no
        // visible label of its own, and "English" alone does not say what
        // pressing it would do.
        aria-label={`${active.nativeName} — ${languages.map((l) => l.nativeName).join(', ')}`}
      >
        <Globe className="size-4" aria-hidden />
        {active.nativeName}
      </DropdownMenuTrigger>

      {/* `align="end"` follows the writing direction, so the menu hangs off the
          same corner the trigger sits in under both LTR and Arabic. */}
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {languages.map((l) => (
          <DropdownMenuItem
            key={l.code}
            // `dir` per item: the Arabic entry has to read right-to-left even
            // while the surrounding UI is still English, which is exactly the
            // state someone is in at the moment they reach for it.
            dir={l.dir}
            onSelect={() => setLanguage(l.code as LanguageCode)}
            className="justify-between gap-3"
          >
            <span>{l.nativeName}</span>
            {l.code === language && <Check className="size-4 text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
