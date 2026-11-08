"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { countExpiredTrash } from "@/lib/services/trash"
import { inventoryApi } from "@/lib/services/inventory"
import { ArticoliControlli } from "@/components/admin/ArticoliControlli"
import { VariantiConfezioni } from "@/components/admin/VariantiConfezioni"
import { AcquistiSpostamenti } from "@/components/admin/AcquistiSpostamenti"
import { UtentiOperai } from "@/components/admin/UtentiOperai"
import { PackageCheck, ListChecks, ScanSearch, Users, Trash2 } from "lucide-react"
import { SectionsPage } from "@/components/layout/SectionsPage"
import { useAuth } from "@/components/auth-provider"
import CestinoPage from "../cestino/page"

// Voci raggruppate per argomento; le vecchie voci (?v=anomalie, ?v=confezioni...) portano alla voce che le contiene
export default function StrumentiAdminPage() {
  const { userRole } = useAuth()
  const admin = userRole === "admin"
  const icon = "h-4 w-4"

  // Pallini: articoli da controllare / anomalie, elementi scaduti nel cestino
  const [articleAlerts, setArticleAlerts] = useState(0)
  const [expiredTrash, setExpiredTrash] = useState(0)
  useEffect(() => {
    if (!admin) return
    Promise.all([inventoryApi.getUnverifiedCount(), inventoryApi.getNegativeLotMovements(), inventoryApi.getOrphanedJobReferences()])
      .then(([unverified, negative, orphaned]) => setArticleAlerts(unverified + negative.length + orphaned.length))
      .catch(console.error)
    countExpiredTrash(supabase).then(setExpiredTrash).catch(console.error)
  }, [admin])

  return (
    <SectionsPage
      title="Strumenti admin"
      sections={[
        { key: "articoli", aliases: ["controllo-articoli", "anomalie"], label: "Controllo articoli", dot: articleAlerts > 0, icon: <PackageCheck className={icon} />, hidden: !admin, render: () => <ArticoliControlli /> },
        { key: "varianti", aliases: ["schede-varianti", "confezioni"], label: "Varianti e confezioni", icon: <ListChecks className={icon} />, hidden: !admin, render: () => <VariantiConfezioni /> },
        { key: "acquisti", aliases: ["controllo-acquisti", "spostamenti"], label: "Acquisti e spostamenti", icon: <ScanSearch className={icon} />, hidden: !admin, render: () => <AcquistiSpostamenti /> },
        { key: "utenti", aliases: ["nuovo-utente", "presenze-operai"], label: "Utenti e operai", icon: <Users className={icon} />, hidden: !admin, render: () => <UtentiOperai /> },
        { key: "cestino", label: "Cestino", dot: expiredTrash > 0, icon: <Trash2 className={icon} />, hidden: !admin, render: () => <CestinoPage /> },
      ]}
    />
  )
}
