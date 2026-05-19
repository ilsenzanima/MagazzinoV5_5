"use client"

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Users, ClipboardList, QrCode } from "lucide-react";
import ArticlesReport from "@/components/reports/articles-report";
import AttendanceReport from "@/components/reports/attendance-report";
import InventoryReport from "@/components/reports/inventory-report";
import QrPrintReport from "@/components/reports/qr-print-report";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("articles");

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Report</h1>
          <p className="text-slate-500 dark:text-slate-400">Analisi e statistiche del magazzino.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-[650px]">
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
