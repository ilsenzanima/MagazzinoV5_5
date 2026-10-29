"use client"

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ListPageHeader } from "@/components/ui/list-page-header";
import { useAuth } from "@/components/auth-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    const query = params.toString();
    router.replace(query ? `/reports?${query}` : "/reports", { scroll: false });
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
          <ListPageHeader title="Report">
          <TabsList className="grid w-full grid-cols-4 lg:w-[640px]">
            <TabsTrigger value="articles" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Articoli</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Presenze</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Inventario</span>
            </TabsTrigger>
            <TabsTrigger value="qr" className="gap-2">
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">QR / Codici</span>
            </TabsTrigger>
          </TabsList>
          </ListPageHeader>

          <TabsContent value="articles">
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
