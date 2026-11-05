"use client"

import { useState } from "react"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { Input } from "@/components/ui/input"

// Freccia di ordinamento nell'intestazione di una tabella
export function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
}

// Nota modificabile con un clic: si salva uscendo dal campo o con Invio, Esc annulla
export function InlineNote({ value, onSave, disabled }: { value: string; onSave: (v: string) => void; disabled?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const commit = () => { setEditing(false); onSave(draft.trim()) }
  if (disabled) return <span className="block truncate px-1 text-xs text-slate-600 dark:text-slate-300" title={value}>{value || <span className="text-slate-300">—</span>}</span>
  if (editing) {
    return (
      <Input
        autoFocus
        className="h-7 w-full text-xs"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false) }}
      />
    )
  }
  return (
    <button
      type="button"
      className="block w-full truncate rounded px-1 py-0.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
      title={value || "Aggiungi una nota"}
      onClick={() => { setDraft(value); setEditing(true) }}
    >
      {value || <span className="italic text-slate-300">Aggiungi nota</span>}
    </button>
  )
}

// Stili comuni delle intestazioni con filtri
export const TABLE_HEAD_CLS = "border-r text-xs font-semibold uppercase tracking-wide text-slate-600"
export const TABLE_SELECT_CLS = "h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase"
