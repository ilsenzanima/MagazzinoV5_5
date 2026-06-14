import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Truck, ShoppingCart, AlertTriangle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";

interface QuickStatsProps {
  activeJobsCount: number;
  monthDDTCount: number;
  monthPurchasesCount: number;
  monthPurchasesTotal: number;
  lowStockCount: number;
}

const monthName = new Date().toLocaleString("it-IT", { month: "long" });

function StatCard({
  href,
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  sub,
}: {
  href: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-5 flex items-center gap-4">
          <div className={`p-3 rounded-xl ${iconBg} shrink-0`}>
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
              {label}
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
              {value}
            </p>
            {sub && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                {sub}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function QuickStats({
  activeJobsCount,
  monthDDTCount,
  monthPurchasesCount,
  monthPurchasesTotal,
  lowStockCount,
}: QuickStatsProps) {
  const { userRole } = useAuth();
  const canSeePrices = userRole === 'admin' || userRole === 'operativo';
  const formatEur = (v: number) =>
    new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        href="/jobs"
        icon={Briefcase}
        iconColor="text-blue-600 dark:text-blue-400"
        iconBg="bg-blue-50 dark:bg-blue-900/30"
        label="Commesse Attive"
        value={activeJobsCount}
        sub="in corso"
      />
      <StatCard
        href="/movements"
        icon={Truck}
        iconColor="text-amber-600 dark:text-amber-400"
        iconBg="bg-amber-50 dark:bg-amber-900/30"
        label={`DDT — ${monthName}`}
        value={monthDDTCount}
        sub="movimenti nel mese"
      />
      <StatCard
        href="/purchases"
        icon={ShoppingCart}
        iconColor="text-emerald-600 dark:text-emerald-400"
        iconBg="bg-emerald-50 dark:bg-emerald-900/30"
        label={`Acquisti — ${monthName}`}
        value={monthPurchasesCount}
        sub={canSeePrices ? formatEur(monthPurchasesTotal) : "—"}
      />
      <StatCard
        href="/inventory?tab=low_stock"
        icon={AlertTriangle}
        iconColor={
          lowStockCount > 0
            ? "text-red-600 dark:text-red-400"
            : "text-slate-400 dark:text-slate-500"
        }
        iconBg={
          lowStockCount > 0
            ? "bg-red-50 dark:bg-red-900/30"
            : "bg-slate-100 dark:bg-slate-800"
        }
        label="Scorta Minima"
        value={lowStockCount}
        sub={lowStockCount > 0 ? "articoli sotto soglia" : "tutto ok"}
      />
    </div>
  );
}
