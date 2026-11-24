"use client"

import * as React from "react"
import { ChevronDown, Loader2, Settings, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Pulsante standard «Azioni» di fine riga: icona con freccetta verso il basso, così si capisce che apre un menu.
// Si usa come trigger di un DropdownMenu (asChild) in tutte le tabelle con azioni per singola riga.
export const RowActionsButton = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  function RowActionsButton({ className, onClick, ...props }, ref) {
    return (
      <Button
        ref={ref}
        type="button"
        variant="outline"
        title="Azioni"
        aria-label="Azioni"
        {...props}
        onClick={e => { e.stopPropagation(); onClick?.(e) }}
        className={cn(
          "h-8 shrink-0 gap-0.5 rounded-full border-slate-300 bg-white px-2.5 text-slate-600 shadow-sm transition-colors",
          "hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 data-[state=open]:border-blue-500 data-[state=open]:bg-blue-50 data-[state=open]:text-blue-700",
          "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
          className,
        )}
      >
        <Settings className="h-4 w-4" />
        <ChevronDown className="h-3 w-3 opacity-70" />
      </Button>
    )
  },
)

// Barra che compare quando ci sono righe selezionate: conteggio a sinistra, azioni (stampa, scarica…) a destra
export function SelectionBar({ count, singular, plural, onClear, children }: { count: number; singular: string; plural: string; onClear: () => void; children?: React.ReactNode }) {
  if (count === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-900 dark:bg-blue-950/30">
      <span className="font-medium text-blue-800 dark:text-blue-200">{count} {count === 1 ? singular : plural}</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {children}
        <Button size="sm" variant="ghost" onClick={onClear} aria-label="Deseleziona"><X className="h-4 w-4" /></Button>
      </div>
    </div>
  )
}

// Pulsante della barra di selezione con indicatore di caricamento
export function BulkButton({ busy, icon, children, ...props }: React.ComponentProps<typeof Button> & { busy?: boolean; icon: React.ReactNode }) {
  return (
    <Button size="sm" variant="outline" {...props}>
      {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <span className="mr-1.5 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}{children}
    </Button>
  )
}
