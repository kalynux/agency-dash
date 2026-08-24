import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';

/**
 * Wraps a tabbed page so a horizontal swipe moves between its tabs.
 *
 * Drop it in place of the page's root `<div>` — it takes the same `className`,
 * so adopting it on a page is a one-line change and the layout is untouched.
 *
 * **A swipe does exactly what tapping the tab would do**, including pushing a
 * history entry. Making the gesture a quieter kind of navigation than the tap
 * (a `replace`, say) would mean the back button behaved differently depending
 * on how the user got to a tab, which is the sort of difference nobody can hold
 * in their head.
 *
 * At the first and last tab the swipe is deliberately NOT consumed, so it
 * bubbles to whatever wraps this page — see `useSwipeNavigation`'s `onNext`.
 * That is what lets a swipe past the last tab of Account carry on into the next
 * bottom-bar section instead of stopping dead.
 *
 * Inert above the phone breakpoint: a mouse has no swipe, and a trackpad's
 * horizontal scroll is not one either.
 */
export function TabSwipeArea<T extends string>({
  tabs,
  active,
  toPath,
  className,
  children,
}: {
  /** Every tab of this page, in the order they are shown. */
  tabs: readonly T[];
  /** The tab currently on screen. */
  active: T;
  /** Route for a tab. */
  toPath: (tab: T) => string;
  className?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const index = tabs.indexOf(active);

  const go = (delta: number): boolean => {
    if (index < 0) return false;
    const next = tabs[index + delta];
    if (!next) return false;
    navigate(toPath(next));
    return true;
  };

  const swipe = useSwipeNavigation({
    enabled: isMobile,
    onNext: () => go(1),
    onPrevious: () => go(-1),
  });

  return (
    <div className={className} {...swipe}>
      {children}
    </div>
  );
}
