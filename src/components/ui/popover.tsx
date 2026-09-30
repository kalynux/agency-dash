"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"
import {
  MobileSheetHandle,
  MobileSheetPanel,
  MobileSheetPortalScrim,
} from "@/components/ui/mobile-sheet"
import {
  mobileSheetScrollArea,
  mobileSheetShell,
} from "@/components/ui/mobile-sheet.styles"

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  asSheet = false,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  /**
   * Below `md`, become a bottom sheet (see `mobile-sheet.tsx`). Off by default
   * here, unlike the vendor dashboard: this app's popovers include pickers that
   * are anchored to a field they type into, and those must not detach. `InfoHint`
   * turns it on — every ⓘ opens as a sheet on a phone.
   */
  asSheet?: boolean
}) {
  return (
    <>
      {/* ⚠ Its own portal — `Popover.Portal` takes exactly one child. */}
      {asSheet && (
        <PopoverPrimitive.Portal>
          <MobileSheetPortalScrim />
        </PopoverPrimitive.Portal>
      )}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-slot="popover-content"
          data-mobile-sheet={asSheet ? "" : undefined}
          align={align}
          sideOffset={sideOffset}
          className={cn(
            "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
            className,
            asSheet && mobileSheetShell
          )}
          {...props}
        >
          {asSheet ? (
            <MobileSheetPanel>
              <MobileSheetHandle />
              {/* `className` is repeated here on purpose: callers pass layout
                  (`p-3`, `space-y-2`) meant for the content, and wrapping the
                  children moved them one level down. On desktop this element is
                  `display: contents`, so nothing doubles; on mobile the shell's
                  `!important` overrides already stripped padding and ground from
                  the outer element. Only the width has to be undone. */}
              <div
                className={cn(
                  className,
                  "max-md:!w-full max-md:!max-w-full",
                  mobileSheetScrollArea,
                )}
              >
                {children}
              </div>
            </MobileSheetPanel>
          ) : (
            children
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </>
  )
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
