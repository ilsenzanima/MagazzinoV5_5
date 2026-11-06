"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-[28px] w-[52px] shrink-0 cursor-pointer items-center rounded-full border-2 border-slate-300 shadow-[inset_0_3px_6px_rgba(0,0,0,0.45),0_1px_0_rgba(255,255,255,0.8)] transition-colors dark:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-blue-700 data-[state=checked]:bg-gradient-to-b data-[state=checked]:from-blue-700 data-[state=checked]:to-blue-500 data-[state=unchecked]:bg-gradient-to-b data-[state=unchecked]:from-slate-600 data-[state=unchecked]:to-slate-500",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-6 w-6 rounded-full border border-slate-300 bg-[radial-gradient(circle_at_35%_30%,#ffffff,#e5e7eb_60%,#cbd5e1)] shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_-2px_3px_rgba(0,0,0,0.12)] ring-0 transition-transform data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
