import { cn } from '@/lib/utils';
import {
  END_PIN_COLOR,
  START_PIN_COLOR,
  START_PIN_COLOR_DARK,
  pinSvg,
  type PinGlyph,
} from '@/components/tracking/pin-icons';

/**
 * The map's start/end pin, inline and small — so a shipment row in the sidebar
 * is labelled with the *same* mark the operator is looking for on the map.
 *
 * The start pin is near-black, which disappears on a dark surface, so it takes
 * the same lighter body the map uses; the green end pin reads on both.
 */
export function PinMark({
  glyph,
  isDark,
  height = 18,
  className,
}: {
  glyph: PinGlyph;
  isDark?: boolean;
  height?: number;
  className?: string;
}) {
  const color =
    glyph === 'store' ? (isDark ? START_PIN_COLOR_DARK : START_PIN_COLOR) : END_PIN_COLOR;
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center', className)}
      dangerouslySetInnerHTML={{ __html: pinSvg({ glyph, color, height }) }}
    />
  );
}
