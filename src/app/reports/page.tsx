"use client"

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Users, ClipboardList, QrCode, Download, Loader2 } from "lucide-react";
import ArticlesReport from "@/components/reports/articles-report";
import AttendanceReport from "@/components/reports/attendance-report";
import InventoryReport from "@/components/reports/inventory-report";
import QrPrintReport from "@/components/reports/qr-print-report";
import DownloadReport from "@/components/reports/download-report";

const REPORT_TABS = ["articles", "attendance", "inventory", "qr", "download"];

function ReportsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Report</h1>
          <p className="text-slate-500 dark:text-slate-400">Analisi e statistiche del magazzino.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 lg:w-[800px]">
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
            <TabsTrigger value="download" className="gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </TabsTrigger>
          </TabsList>

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

          <TabsContent value="download" className="mt-6">
            <DownloadReport />
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
