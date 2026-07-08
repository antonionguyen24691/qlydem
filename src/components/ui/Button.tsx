import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          {
            "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm": variant === "primary",
            "border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900": variant === "outline",
            "hover:bg-zinc-100 text-zinc-700": variant === "ghost",
            "bg-red-600 text-white hover:bg-red-700 shadow-sm": variant === "danger",
            "h-9 px-3 text-sm": size === "sm", // Desktop small
            "min-h-[44px] px-4 py-2 text-sm sm:h-10 sm:min-h-0": size === "md", // Mobile touch-friendly, normal on desktop
            "min-h-[48px] px-8 text-base": size === "lg", // Large touch area
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
