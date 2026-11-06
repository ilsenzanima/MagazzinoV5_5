import { redirect } from "next/navigation"

// La pagina "Report e analisi" non esiste più: i report sono in /reports, l'analisi spostamenti è negli Strumenti admin
export default function ReportAnalisiPage() {
  redirect("/reports")
}
