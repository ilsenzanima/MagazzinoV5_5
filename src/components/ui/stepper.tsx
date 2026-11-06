"use client"

import { Check, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

// Indicatore dei passi: striscia scura come le altre intestazioni, con cerchio numerato,
// segno di spunta sui passi fatti e passo attivo evidenziato in blu. Su telefono resta scritto solo il passo attivo.
export function Stepper({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  return (
    <ol
      aria-label="Avanzamento"
      className={cn("mt-3 flex items-center gap-1 rounded-xl bg-slate-800 p-1.5 text-white shadow-inner dark:bg-slate-700", className)}
    >
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label + i} className="flex min-w-0 flex-1 items-center gap-1" aria-current={active ? "step" : undefined}>
            <div
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
                active ? "bg-slate-950/50" : ""
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  active && "bg-blue-600 text-white shadow-[0_0_0_3px_rgba(37,99,235,0.35)]",
                  done && "bg-emerald-500 text-white",
                  !active && !done && "bg-slate-600 text-slate-300"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn("truncate text-xs font-semibold", active ? "text-white" : done ? "text-slate-200 max-sm:hidden" : "text-slate-400 max-sm:hidden")}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}
