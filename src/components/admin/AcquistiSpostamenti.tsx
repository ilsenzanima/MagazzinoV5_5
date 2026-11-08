"use client"

import { ScanSearch, TrendingUp } from "lucide-react"
import { NotchTabs } from "@/components/ui/notch-tabs"
import { useSubTab } from "@/hooks/useSubTab"
import { ControlloAcquistiContent } from "@/app/controllo-acquisti/page"
import { AnalyticsContent } from "@/app/analytics/page"

// Controllo acquisti + Analisi spostamenti: due schede della stessa voce
export function AcquistiSpostamenti() {
  const [tab, setTab] = useSubTab(["controllo", "spostamenti"], "controllo")
  return (
    <div className="space-y-4">
      <NotchTabs
        title="Acquisti e spostamenti"
        tabWidth={190}
        items={[
          { value: "controllo", label: "Controllo acquisti", icon: <ScanSearch /> },
          { value: "spostamenti", label: "Analisi spostamenti", icon: <TrendingUp /> },
        ]}
        value={tab}
        onValueChange={setTab}
      >
        {tab === "controllo" ? <ControlloAcquistiContent embedded /> : <AnalyticsContent embedded />}
      </NotchTabs>
    </div>
  )
}
