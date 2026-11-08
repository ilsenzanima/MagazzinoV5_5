"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { Switch } from "@/components/ui/switch"
import { Card } from "@/components/ui/card"
import { REQUIRED_DAILY_HOURS } from "@/lib/services/attendance-check"

interface Row { id: string; first_name: string | null; last_name: string | null; attendance_check: boolean }

export function AttendanceWorkersSettings() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from("workers")
      .select("id, first_name, last_name, attendance_check")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("last_name")
      .then(({ data, error }) => {
        if (error) toast.error("Impossibile caricare gli operai")
        setRows((data ?? []) as Row[])
        setLoading(false)
      })
  }, [])

  const toggle = async (row: Row, value: boolean) => {
    setRows(prev => prev.map(r => (r.id === row.id ? { ...r, attendance_check: value } : r)))
    const { error } = await supabase.from("workers").update({ attendance_check: value }).eq("id", row.id)
    if (error) {
      toast.error("Salvataggio non riuscito")
      setRows(prev => prev.map(r => (r.id === row.id ? { ...r, attendance_check: !value } : r)))
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Un giorno lavorativo (lun-ven, escluse le festività) risulta «da segnare» se almeno uno degli operai selezionati ha meno di {REQUIRED_DAILY_HOURS} ore
        totali segnate (presenze, ferie, malattia e permessi contano tutti). Togli la spunta agli operai che non sono sempre in squadra.
      </p>
      <Card className="divide-y">
        {loading && <div className="p-4 text-sm text-muted-foreground">Caricamento...</div>}
        {rows.map(r => (
          <label key={r.id} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
            <span className="text-sm font-medium">{`${r.last_name ?? ""} ${r.first_name ?? ""}`.trim()}</span>
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              {r.attendance_check ? "Conteggiato" : "Non conteggiato"}
              <Switch checked={r.attendance_check} onCheckedChange={v => toggle(r, v)} />
            </span>
          </label>
        ))}
      </Card>
    </div>
  )
}
