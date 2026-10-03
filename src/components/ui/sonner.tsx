import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useUIStore } from "@/store"

// The theme comes from the app's own store, not `next-themes`: no
// `ThemeProvider` is mounted, so `useTheme()` always answered "system" and a
// toast followed the OS instead of the in-app light/dark choice.
//
// Our tokens are bare HSL triplets (`--popover: 0 0% 100%`), so each one has
// to be wrapped in `hsl()`. A bare `var(--popover)` is an invalid colour and
// left neutral toasts with a transparent background.
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useUIStore()

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
