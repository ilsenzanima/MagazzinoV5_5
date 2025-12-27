"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { CalendarView } from "@/components/dashboard/CalendarView";
import { AttendanceChart } from "@/components/dashboard/AttendanceChart";
import { RecentMovements } from "@/components/dashboard/RecentMovements";
import { ActiveJobsWidget } from "@/components/dashboard/ActiveJobs";

// Definiamo il tipo dei dati che ci aspettiamo dal Server
interface DashboardStats {
  totalValue: number;
  lowStockCount: number;
  totalItems: number;
}

export function DashboardClient({ initialStats }: { initialStats: DashboardStats }) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-6">
           <h1 className="text-2xl font-bold text-slate-900 dark:text-white hidden md:block">Dashboard</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Panoramica</TabsTrigger>
            <TabsTrigger value="calendar">Calendario Presenze</TabsTrigger>
            <TabsTrigger value="analytics">Analisi</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Passiamo i dati calcolati dal server ai componenti */}
            <StatsCards 
              totalValue={initialStats.totalValue} 
              lowStockCount={initialStats.lowStockCount}
              totalItems={initialStats.totalItems}
            />
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4">
                  <RecentMovements />
                </div>
                <div className="col-span-3">
                  <ActiveJobsWidget />
                </div>
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            {activeTab === 'calendar' && <CalendarView />}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            {activeTab === 'analytics' && <AttendanceChart />}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}