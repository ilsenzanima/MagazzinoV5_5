"use client"

import { Boxes, ListChecks } from "lucide-react"
import { NotchTabs } from "@/components/ui/notch-tabs"
import { useSubTab } from "@/hooks/useSubTab"
import { SchedeVariantiContent } from "@/app/schede-varianti/page"
import { ConfezioniContent } from "@/app/confezioni/page"

// Schede varianti + Quantità confezioni: due schede della stessa voce
export function VariantiConfezioni() {
  const [tab, setTab] = useSubTab(["schede", "confezioni"], "schede")
  return (
    <div className="space-y-4">
      <NotchTabs
        title="Varianti e confezioni"
        tabWidth={190}
        items={[
          { value: "schede", label: "Schede varianti", icon: <ListChecks /> },
          { value: "confezioni", label: "Quantità confezioni", icon: <Boxes /> },
        ]}
        value={tab}
        onValueChange={setTab}
      >
        {tab === "schede" ? <SchedeVariantiContent embedded /> : <ConfezioniContent embedded />}
      </NotchTabs>
    </div>
  )
}
