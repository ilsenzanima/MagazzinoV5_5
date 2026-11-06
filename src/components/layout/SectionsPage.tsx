"use client"

import { Suspense, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import DashboardLayout from "./DashboardLayout"
import { NotchTabs, NestedStripCtx } from "@/components/ui/notch-tabs"

export interface SectionDef {
  key: string
  label: string
  icon: ReactNode
  render: () => ReactNode
  hidden?: boolean
}

function Inner({ title, sections, merge }: { title: string; sections: SectionDef[]; merge?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const visible = sections.filter(s => !s.hidden)
  const current = visible.find(s => s.key === params.get("v")) ?? visible[0]

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <NotchTabs
          title={title}
          compact={!merge}
          items={visible.length > 1 ? visible.map(s => ({ value: s.key, label: s.label, icon: s.icon })) : []}
          value={current?.key ?? ""}
          onValueChange={key => router.replace(`${pathname}?v=${key}`)}
        >
          {/* merge: la pagina sotto non ha una striscia sua, mette ricerca e pulsanti nella striscia di sopra */}
          {merge && <div key={current?.key}>{current?.render()}</div>}
        </NotchTabs>
        {!merge && (
          <NestedStripCtx.Provider value={true}>
            <div key={current?.key}>{current?.render()}</div>
          </NestedStripCtx.Provider>
        )}
      </div>
    </DashboardLayout>
  )
}

// Pagina che raccoglie più pagine: un menu a tendina per passare dall'una all'altra, la scelta resta nell'indirizzo (?v=)
export function SectionsPage(props: { title: string; sections: SectionDef[]; merge?: boolean }) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  )
}
