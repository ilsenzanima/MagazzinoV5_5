"use client"

import { Suspense, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import DashboardLayout from "./DashboardLayout"
import { JobSectionMenu } from "@/components/jobs/JobSectionMenu"

export interface SectionDef {
  key: string
  label: string
  icon: ReactNode
  render: () => ReactNode
  hidden?: boolean
}

function Inner({ title, sections }: { title: string; sections: SectionDef[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const visible = sections.filter(s => !s.hidden)
  const current = visible.find(s => s.key === params.get("v")) ?? visible[0]

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {visible.length > 1 && (
          <JobSectionMenu
            groups={[{ key: "sections", label: title, items: visible.map(s => ({ key: s.key, label: s.label, icon: s.icon })) }]}
            activeKey={current?.key ?? ""}
            onSelect={(_g, key) => router.replace(`${pathname}?v=${key}`)}
          />
        )}
        <div key={current?.key}>{current?.render()}</div>
      </div>
    </DashboardLayout>
  )
}

// Pagina che raccoglie più pagine: un menu a tendina per passare dall'una all'altra, la scelta resta nell'indirizzo (?v=)
export function SectionsPage(props: { title: string; sections: SectionDef[] }) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  )
}
