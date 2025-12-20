import DashboardLayout from "@/components/layout/DashboardLayout";
import { SidebarNav } from "./components/settings-sidebar";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impostazioni",
  description: "Gestisci le impostazioni del tuo account e dell'applicazione.",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      <div className="space-y-6 pb-16">
        <div className="space-y-0.5">
          <h2 className="text-2xl font-bold tracking-tight">Impostazioni</h2>
          <p className="text-muted-foreground">
            Gestisci le preferenze del tuo account e le impostazioni di sistema.
          </p>
        </div>
        <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
          <aside className="-mx-4 lg:w-1/5 px-4 lg:px-0">
            <SidebarNav />
          </aside>
          <div className="flex-1 lg:max-w-2xl">{children}</div>
        </div>
      </div>
    </DashboardLayout>
  );
}
