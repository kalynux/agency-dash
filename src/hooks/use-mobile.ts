import * as React from "react"

const MOBILE_BREAKPOINT = 768
const DESKTOP_BREAKPOINT = 1024

/**
 * Track whether the viewport is narrower than `maxWidthExclusive`.
 * State is seeded synchronously from the current width so the first paint
 * already matches the device — no desktop→mobile flash on load.
 */
function useMaxWidth(maxWidthExclusive: number): boolean {
  const [match, setMatch] = React.useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < maxWidthExclusive : false,
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${maxWidthExclusive - 1}px)`)
    const onChange = () => setMatch(window.innerWidth < maxWidthExclusive)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [maxWidthExclusive])

  return match
}

/** Phone range (< 768px): drives the bottom tab-bar shell instead of the sidebar. */
export function useIsMobile(): boolean {
  return useMaxWidth(MOBILE_BREAKPOINT)
}

/**
 * Below the desktop breakpoint (< 1024px). Within the rendered desktop shell
 * (≥ 768px) this marks the tablet band, where the sidebar auto-collapses to its
 * icon rail so a fixed 256px sidebar doesn't squeeze the content column.
 */
export function useIsBelowDesktop(): boolean {
  return useMaxWidth(DESKTOP_BREAKPOINT)
}
