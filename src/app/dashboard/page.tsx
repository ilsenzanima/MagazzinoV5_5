"use client"

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { CalendarView } from "@/components/dashboard/CalendarView";
import { AttendanceChart } from "@/components/dashboard/AttendanceChart";
import { RecentMovements } from "@/components/dashboard/RecentMovements";
import { ActiveJobsWidget } from "@/components/dashboard/ActiveJobs";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { createClient } from "@/lib/supabase/client";
import { fetchWithTimeout } from "@/lib/api";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState({
    totalValue: 0,
    lowStockCount: 0,
    totalItems: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const supabase = createClient();
        
        // 1. Fetch Inventory for Counts
        const { data: inventory, error: invError } = await fetchWithTimeout(
          supabase
            .from('inventory')
            .select('quantity, min_stock')
        );

        if (invError) throw invError;

        // 2. Fetch Batches for Value Calculation (FIFO/Batch Specific Cost)
        const { data: batches, error: batchError } = await fetchWithTimeout(
            supabase
                .from('purchase_batch_availability')
                .select('remaining_pieces, coefficient, unit_price')
        );

        if (batchError) throw batchError;

        let totalVal = 0;
        let lowStock = 0;

        // Calculate Value from Batches (Pieces * Coeff * Price)
        batches?.forEach(batch => {
            const pieces = batch.remaining_pieces || 0;
            const coeff = batch.coefficient || 1; // Default to 1 if missing
            const price = batch.unit_price || 0;
            
            // Formula: Value = (Pieces * Coeff) * Price
            if (pieces > 0) {
                totalVal += (pieces * coeff) * price;
            }
        });

        // Calculate Low Stock from Inventory Items
        inventory?.forEach(item => {
          if ((item.quantity || 0) <= (item.min_stock || 0)) {
            lowStock++;
          }
        });

        setStats({
          totalValue: totalVal,
          lowStockCount: lowStock,
          totalItems: inventory?.length || 0
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
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
            {loading ? (
              <DashboardSkeleton />
            ) : (
              <StatsCards 
                totalValue={stats.totalValue} 
                lowStockCount={stats.lowStockCount}
                totalItems={stats.totalItems}
              />
            )}
            
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
