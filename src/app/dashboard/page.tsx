"use client"

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { CalendarView } from "@/components/dashboard/CalendarView";
import { AttendanceChart } from "@/components/dashboard/AttendanceChart";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";

export default function Dashboard() {
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
        
        const { data: inventory, error } = await supabase
          .from('inventory')
          .select('quantity, price, min_stock');

        if (error) throw error;

        let totalVal = 0;
        let lowStock = 0;

        inventory?.forEach(item => {
          totalVal += (item.quantity || 0) * (item.price || 0);
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
           <h1 className="text-2xl font-bold text-slate-900 hidden md:block">Dashboard</h1>
           <div className="flex items-center gap-4 ml-auto">
             <Avatar>
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback><User /></AvatarFallback>
            </Avatar>
           </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Panoramica</TabsTrigger>
            <TabsTrigger value="calendar">Calendario Presenze</TabsTrigger>
            <TabsTrigger value="analytics">Analisi</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <StatsCards 
              totalValue={stats.totalValue} 
              lowStockCount={stats.lowStockCount}
              totalItems={stats.totalItems}
            />
            {/* We can add more overview content here later */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Example placeholder for recent activity or quick list */}
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            <CalendarView />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <AttendanceChart />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
