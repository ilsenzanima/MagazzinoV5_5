"use client"

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { CalendarView } from "@/components/dashboard/CalendarView";
import { AttendanceChart } from "@/components/dashboard/AttendanceChart";
import { RecentMovements } from "@/components/dashboard/RecentMovements";
import { ActiveJobsWidget } from "@/components/dashboard/ActiveJobs";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, LogOut, Settings, CreditCard } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalValue: 0,
    lowStockCount: 0,
    totalItems: 0
  });
  const [loading, setLoading] = useState(true);
  const { signOut, user } = useAuth();
  const router = useRouter();

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

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
           <h1 className="text-2xl font-bold text-slate-900 hidden md:block">Dashboard</h1>
           <div className="flex items-center gap-4 ml-auto">
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="cursor-pointer hover:opacity-80 transition-opacity">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback><User /></AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel>Il mio Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push('/settings/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profilo</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Impostazioni</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Disconnetti</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
             </DropdownMenu>
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
