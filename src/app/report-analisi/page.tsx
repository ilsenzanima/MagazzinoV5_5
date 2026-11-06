"use client"

import { BarChart3, TrendingUp } from "lucide-react"
import { SectionsPage } from "@/components/layout/SectionsPage"
import { useAuth } from "@/components/auth-provider"
import ReportsPage from "../reports/page"
import AnalyticsPage from "../analytics/page"

export default function ReportAnalisiPage() {
  const { userRole } = useAuth()
  return (
    <SectionsPage
      title="Report e analisi"
      sections={[
        { key: "report", label: "Report", icon: <BarChart3 className="h-4 w-4" />, hidden: userRole !== "admin" && userRole !== "operativo", render: () => <ReportsPage /> },
        { key: "spostamenti", label: "Analisi spostamenti", icon: <TrendingUp className="h-4 w-4" />, render: () => <AnalyticsPage /> },
      ]}
    />
  )
}
