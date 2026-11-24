"use client"

import * as React from "react"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Pulsante standard «Azioni» di fine riga: bordo e sfondo visibili così si capisce che è cliccabile.
// Si usa come trigger di un DropdownMenu (asChild) in tutte le tabelle con azioni per singola riga.
export const RowActionsButton = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  function RowActionsButton({ className, onClick, ...props }, ref) {
    return (
      <Button
        ref={ref}
        type="button"
        variant="outline"
        size="icon"
        title="Azioni"
        aria-label="Azioni"
        {...props}
        onClick={e => { e.stopPropagation(); onClick?.(e) }}
        className={cn(
          "h-8 w-8 shrink-0 rounded-full border-slate-300 bg-white text-slate-600 shadow-sm transition-colors",
          "hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 data-[state=open]:border-blue-500 data-[state=open]:bg-blue-50 data-[state=open]:text-blue-700",
          "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
          className,
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    )
  },
)
