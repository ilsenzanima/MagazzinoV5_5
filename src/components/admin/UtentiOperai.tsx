"use client"

import { CalendarCheck, Shield, UserPlus } from "lucide-react"
import { NotchTabs } from "@/components/ui/notch-tabs"
import { useSubTab } from "@/hooks/useSubTab"
import { UsersAdmin } from "@/components/admin/UsersAdmin"
import { CreateUserForm } from "@/components/admin/CreateUserForm"
import { AttendanceWorkersSettings } from "@/components/admin/AttendanceWorkersSettings"

// Utenti e ruoli + Nuovo utente + Presenze operai: tre schede della stessa voce
export function UtentiOperai() {
  const [tab, setTab] = useSubTab(["utenti", "nuovo", "presenze"], "utenti")
  return (
    <div className="space-y-4">
      <NotchTabs
        title="Utenti e operai"
        tabWidth={170}
        items={[
          { value: "utenti", label: "Utenti e ruoli", icon: <Shield /> },
          { value: "nuovo", label: "Nuovo utente", icon: <UserPlus /> },
          { value: "presenze", label: "Presenze operai", icon: <CalendarCheck /> },
        ]}
        value={tab}
        onValueChange={setTab}
      >
        {tab === "presenze" && <AttendanceWorkersSettings />}
      </NotchTabs>
      {tab === "utenti" && <UsersAdmin />}
      {tab === "nuovo" && <CreateUserForm />}
    </div>
  )
}
