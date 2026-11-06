"use client"

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { NotchTabs } from "@/components/ui/notch-tabs";
import { useAuth } from "@/components/auth-provider";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Package, Users, ClipboardList, QrCode, Loader2 } from "lucide-react";
import ArticlesReport from "@/components/reports/articles-report";
import AttendanceReport from "@/components/reports/attendance-report";
import InventoryReport from "@/components/reports/inventory-report";
import QrPrintReport from "@/components/reports/qr-print-report";

const REPORT_TABS = ["articles", "attendance", "inventory", "qr"];

function ReportsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userRole } = useAuth();
  const canView = userRole === "admin" || userRole === "operativo";
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    initialTab && REPORT_TABS.includes(initialTab) ? initialTab : "articles"
  );

  // Keep the URL in sync with the active tab so browser back/forward
  // restores the exact view instead of resetting it.
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== "articles") params.set("tab", activeTab);
    // Dentro una pagina unita (/anagrafiche, /report-analisi) resta sulla pagina corrente e mantiene la scheda scelta (?v=)
    const here = typeof window !== "undefined" ? window.location.pathname : "/reports";
    const section = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("v") : null;
    if (section) params.set("v", section);
    const query = params.toString();
    router.replace(query ? `${here}?${query}` : here, { scroll: false });
  }, [activeTab, router]);

  // Solo admin e operativi vedono i report
  useEffect(() => {
    if (userRole && !canView) router.push("/dashboard");
  }, [userRole, canView, router]);

  if (!canView) {
    return <DashboardLayout><div className="py-20 text-center text-slate-400">Caricamento...</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <NotchTabs
            title="Report"
            items={[
              { value: "articles", label: "Articoli", icon: <Package /> },
              { value: "attendance", label: "Presenze", icon: <Users /> },
              { value: "inventory", label: "Inventario", icon: <ClipboardList /> },
              { value: "qr", label: "QR / Codici", icon: <QrCode /> },
            ]}
            value={activeTab}
            onValueChange={setActiveTab}
          />

          <TabsContent value="articles" className="mt-6">
            <ArticlesReport />
          </TabsContent>

          <TabsContent value="attendance" className="mt-6">
            <AttendanceReport />
          </TabsContent>

          <TabsContent value="inventory" className="mt-6">
            <InventoryReport />
          </TabsContent>

          <TabsContent value="qr" className="mt-6">
            <QrPrintReport />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    }>
      <ReportsContent />
    </Suspense>
  );
}
