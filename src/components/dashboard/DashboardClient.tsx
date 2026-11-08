"use client";

import { memo } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { RecentMovements } from "@/components/dashboard/RecentMovements";
import { RecentPurchasesCard } from "@/components/dashboard/RecentPurchasesCard";
import { ActiveJobsGrid } from "@/components/dashboard/ActiveJobsGrid";
import { NotchTabs, NotchActions } from "@/components/ui/notch-tabs";
import { useAuth } from "@/components/auth-provider";
import { formatCurrency } from "@/lib/utils/format";

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

// Saluto in base all'ora del giorno
function greeting(hour: number) {
  if (hour >= 5 && hour < 13) return "Buongiorno";
  if (hour >= 13 && hour < 18) return "Buon pomeriggio";
  if (hour >= 18 && hour < 22) return "Buonasera";
  return "Buonanotte";
}

// Pillola della striscia scura: etichetta + valore, cliccabile
function StripLink({ href, label, value, alert }: { href: string; label: string; value: string | number; alert?: boolean }) {
  return (
    <Link
      href={href}
      className="inline-flex items-baseline gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium normal-case tracking-normal text-slate-300 transition-colors hover:bg-white/20"
    >
      {label}
      <b className={`text-sm font-semibold ${alert ? "text-amber-300" : "text-white"}`}>{value}</b>
    </Link>
  );
}

export const DashboardClient = memo(function DashboardClient({
  stats,
  activeJobs,
  recentDDT,
  recentPurchases,
}: DashboardClientProps) {
  const { fullName, userRole } = useAuth();
  const canSeePrices = userRole === "admin" || userRole === "operativo";
  const firstName = fullName?.trim().split(/\s+/)[0] ?? "";
  const monthName = new Date().toLocaleString("it-IT", { month: "long" });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1700px] space-y-6 pb-8">
        {/* Saluto */}
        <h1 className="px-2 text-center text-lg font-semibold text-slate-800 dark:text-slate-100 md:text-2xl" suppressHydrationWarning>
          {greeting(new Date().getHours())}{firstName ? `, ${firstName}` : ""}
        </h1>

        <NotchTabs title="Panoramica">
          <NotchActions>
            <StripLink href="/jobs" label="Commesse attive" value={stats.activeJobsCount} />
            <StripLink href="/movements" label={`DDT di ${monthName}`} value={stats.monthDDTCount} />
            <StripLink
              href="/purchases"
              label={`Acquisti di ${monthName}`}
              value={canSeePrices ? `${stats.monthPurchasesCount} · ${formatCurrency(stats.monthPurchasesTotal)}` : stats.monthPurchasesCount}
            />
            <StripLink href="/inventory?tab=low_stock" label="Scorta minima" value={stats.lowStockCount} alert={stats.lowStockCount > 0} />
          </NotchActions>

          <div className="space-y-6">
            {/* DDT + Acquisti */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <RecentMovements data={recentDDT} />
              <RecentPurchasesCard data={recentPurchases} />
            </div>

            {/* Commesse attive */}
            <ActiveJobsGrid jobs={activeJobs} />
          </div>
        </NotchTabs>
      </div>
    </DashboardLayout>
  );
});
