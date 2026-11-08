"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { countExpiredTrash } from "@/lib/services/trash"
import { UsersAdmin } from "@/components/admin/UsersAdmin"
import { AttendanceWorkersSettings } from "@/components/admin/AttendanceWorkersSettings"
import { AlertTriangle, Boxes, CalendarCheck, Shield, ListChecks, PackageCheck, ScanSearch, Trash2, TrendingUp, UserPlus } from "lucide-react"
import { SectionsPage } from "@/components/layout/SectionsPage"
import { useAuth } from "@/components/auth-provider"
import VerificaPage from "../inventory/verifica/page"
import AnomaliePage from "../anomalie/page"
import ControlloAcquistiPage from "../controllo-acquisti/page"
import SchedeVariantiPage from "../schede-varianti/page"
import ConfezioniPage from "../confezioni/page"
import CestinoPage from "../cestino/page"
import AnalyticsPage from "../analytics/page"
import { CreateUserForm } from "@/components/admin/CreateUserForm"

export default function StrumentiAdminPage() {
  const { userRole } = useAuth()
  const admin = userRole === "admin"
  const icon = "h-4 w-4"
  // Pallino sul Cestino quando ci sono elementi scaduti da eliminare
  const [expiredTrash, setExpiredTrash] = useState(0)
  useEffect(() => {
    if (!admin) return
    countExpiredTrash(supabase).then(setExpiredTrash).catch(console.error)
  }, [admin])
  return (
    <SectionsPage
      title="Strumenti admin"
      sections={[
        { key: "controllo-articoli", label: "Controllo Articoli", icon: <PackageCheck className={icon} />, hidden: !admin, render: () => <VerificaPage /> },
        { key: "anomalie", label: "Anomalie", icon: <AlertTriangle className={icon} />, hidden: !admin, render: () => <AnomaliePage /> },
        { key: "controllo-acquisti", label: "Controllo Acquisti", icon: <ScanSearch className={icon} />, hidden: !admin, render: () => <ControlloAcquistiPage /> },
        { key: "schede-varianti", label: "Schede Varianti", icon: <ListChecks className={icon} />, hidden: !admin, render: () => <SchedeVariantiPage /> },
        { key: "confezioni", label: "Quantità Confezioni", icon: <Boxes className={icon} />, hidden: !admin, render: () => <ConfezioniPage /> },
        { key: "spostamenti", label: "Analisi Spostamenti", icon: <TrendingUp className={icon} />, hidden: !admin, render: () => <AnalyticsPage /> },
        { key: "presenze-operai", label: "Presenze operai", icon: <CalendarCheck className={icon} />, hidden: !admin, render: () => <AttendanceWorkersSettings /> },
        { key: "utenti", label: "Utenti e ruoli", icon: <Shield className={icon} />, hidden: !admin, render: () => <UsersAdmin /> },
        { key: "nuovo-utente", label: "Nuovo utente", icon: <UserPlus className={icon} />, hidden: !admin, render: () => <CreateUserForm /> },
        { key: "cestino", label: "Cestino", dot: expiredTrash > 0, icon: <Trash2 className={icon} />, hidden: !admin, render: () => <CestinoPage /> },
      ]}
    />
  )
}
