import type { MouseEvent, ReactNode } from 'react';

import { useLanguage } from '@/i18n/useLanguage';
import { legalUrl, type LegalDocument } from '@/lib/legal';
import { cn } from '@/lib/utils';
import { openExternal } from '@/platform/browser';
import { isNative } from '@/platform/env';

/**
 * A link to one of the legal documents, in the UI's language (see `lib/legal`).
 *
 * On the web it is a plain `<a target="_blank">`. In the native shell it must
 * never navigate the WebView — that would replace the app with a page it has no
 * way back from — so the click goes through `openExternal` (`Browser.open`, a
 * Custom Tab over the app). The global interceptor in `platform/browser` would
 * catch it too; handling it here keeps the guarantee local, and the
 * `defaultPrevented` check stops the two from opening it twice.
 *
 * `stopPropagation` because these links sit inside checkbox labels: tapping the
 * document's name is a request to read it, not to agree to it.
 *
 * `children` is optional because `<Trans components={{ terms: <LegalLink … /> }}>`
 * supplies the translated name as children.
 */
export function LegalLink({
  doc,
  children,
  className,
}: {
  doc: LegalDocument;
  children?: ReactNode;
  className?: string;
}) {
  const { language } = useLanguage();
  const href = legalUrl(doc, language);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    if (!isNative || event.defaultPrevented) return;
    event.preventDefault();
    void openExternal(href);
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={cn('font-medium text-primary underline underline-offset-2', className)}
    >
      {children}
    </a>
  );
}
