"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Switch } from "@/components/ui/switch"
import { NotchHelp } from "@/components/ui/notch-tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
    <>
      <NotchHelp
        wide
        title="Presenze operai"
        lines={[`Un giorno lavorativo (lun-ven, escluse le festività) risulta «da segnare» se almeno uno degli operai conteggiati ha meno di ${REQUIRED_DAILY_HOURS} ore totali segnate (presenze, ferie, malattia e permessi contano tutti). Togli la spunta agli operai che non sono sempre in squadra.`]}
      />
      <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
          <TableHeader>
            <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Operaio</TableHead>
              <TableHead className="w-44 text-xs font-semibold uppercase tracking-wide text-slate-600">Giorni da segnare</TableHead>
              <TableHead className="w-24 text-xs font-semibold uppercase tracking-wide text-slate-600">Conta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" /></TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="py-2 text-sm font-medium capitalize">{`${r.last_name ?? ""} ${r.first_name ?? ""}`.trim()}</TableCell>
                <TableCell className="py-2 text-sm text-muted-foreground">{r.attendance_check ? "Conteggiato" : "Non conteggiato"}</TableCell>
                <TableCell className="py-2"><Switch checked={r.attendance_check} onCheckedChange={v => toggle(r, v)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
