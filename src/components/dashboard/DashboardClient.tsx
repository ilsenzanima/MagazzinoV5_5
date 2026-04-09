"use client";

import { memo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { RecentMovements } from "@/components/dashboard/RecentMovements";
import { RecentPurchasesCard } from "@/components/dashboard/RecentPurchasesCard";
import { ActiveJobsGrid } from "@/components/dashboard/ActiveJobsGrid";

interface DashboardStats {
  activeJobsCount: number;
  monthDDTCount: number;
  monthPurchasesCount: number;
  monthPurchasesTotal: number;
  lowStockCount: number;
}

interface DashboardClientProps {
  stats: DashboardStats;
  activeJobs: any[];
  recentDDT: any[];
  recentPurchases: any[];
}

export const DashboardClient = memo(function DashboardClient({
  stats,
  activeJobs,
  recentDDT,
  recentPurchases,
}: DashboardClientProps) {
  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        {/* KPI */}
        <QuickStats
          activeJobsCount={stats.activeJobsCount}
          monthDDTCount={stats.monthDDTCount}
          monthPurchasesCount={stats.monthPurchasesCount}
          monthPurchasesTotal={stats.monthPurchasesTotal}
          lowStockCount={stats.lowStockCount}
        />

        {/* DDT + Acquisti */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RecentMovements data={recentDDT} />
          <RecentPurchasesCard data={recentPurchases} />
        </div>

        {/* Commesse attive */}
        <ActiveJobsGrid jobs={activeJobs} />
      </div>
    </DashboardLayout>
  );
});
