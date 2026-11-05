"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-auto w-fit max-w-full flex-wrap items-end justify-start gap-1 rounded-none border-b-2 border-slate-300 bg-transparent p-0 dark:border-slate-600",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative -mb-[2px] inline-flex flex-none items-center justify-center gap-2 rounded-t-lg rounded-b-none border border-b-0 border-t-[3px] border-slate-300 border-t-slate-300 bg-slate-200 px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:z-10 data-[state=active]:border-slate-300 data-[state=active]:border-t-blue-600 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-[0_-2px_6px_rgba(15,23,42,0.08)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-blue-400 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
