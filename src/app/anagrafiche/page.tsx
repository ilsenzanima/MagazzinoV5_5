"use client"

import { Store, Users } from "lucide-react"
import { SectionsPage } from "@/components/layout/SectionsPage"
import { useAuth } from "@/components/auth-provider"
import ClientsPage from "../clients/page"
import SuppliersPage from "../suppliers/page"

export default function AnagrafichePage() {
  const { userRole } = useAuth()
  return (
    <SectionsPage
      title="Committenti e fornitori"
      sections={[
        { key: "committenti", label: "Committenti", icon: <Users className="h-4 w-4" />, render: () => <ClientsPage /> },
        { key: "fornitori", label: "Fornitori", icon: <Store className="h-4 w-4" />, hidden: userRole !== "admin" && userRole !== "operativo", render: () => <SuppliersPage /> },
      ]}
    />
  )
}
