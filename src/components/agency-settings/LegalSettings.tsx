import { useTranslation } from 'react-i18next';
import { ExternalLink, FileText, Scale, ShieldCheck } from 'lucide-react';

import { LegalLink } from '@/components/common/LegalLink';
import { SectionHeading } from '@/components/common/InfoHint';
import { sectionSurfaceClass } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { LegalDocument } from '@/lib/legal';

const ROWS = [
  { doc: 'terms', icon: FileText },
  { doc: 'privacy', icon: ShieldCheck },
] as const satisfies readonly { doc: LegalDocument; icon: typeof FileText }[];

/**
 * Settings → Preferences → Legal: the two documents every account agreed to at
 * sign-up, one tap away afterwards. Each row is a `LegalLink`, so it opens the
 * document in the UI's language, outside the WebView on native.
 */
export function LegalSettings() {
  const { t } = useTranslation('settings');

  return (
    <Card className={sectionSurfaceClass}>
      <SectionHeading
        icon={Scale}
        title={t('legal.title')}
        description={t('legal.description')}
        short={t('legal.short')}
      />
      <CardContent className="space-y-1 max-md:px-0">
        {ROWS.map(({ doc }, index) => (
          <div key={doc}>
            {index > 0 && <Separator className="my-1" />}
            <LegalLink
              doc={doc}
              className="flex min-h-11 items-center gap-3 rounded-md py-2 font-normal text-foreground no-underline hover:text-primary"
            >
              <span className="flex-1 text-sm font-medium">{t(`legal.${doc}`)}</span>
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </LegalLink>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
