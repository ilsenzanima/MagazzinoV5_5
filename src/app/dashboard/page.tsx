import { createClient } from "@/lib/supabase/server"; // Importante: usa la versione SERVER
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Componente di caricamento mentre il server recupera i dati
function DashboardSkeleton() {
  return (
    <div className="p-8 pt-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
         <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  // 1. Creiamo il client lato server (non soffre di problemi di timeout del browser)
  const supabase = await createClient();

  // 2. Usiamo la RPC per calcolare tutto lato database (Performance Fix)
  // Questo sostituisce il download di migliaia di righe e il ciclo foreach
  const { data: statsData, error } = await supabase.rpc('get_dashboard_stats');

  if (error) {
    console.error("Errore caricamento dashboard (rpc):", error);
  }

  // Fallback sicuro se la RPC fallisce o ritorna null
  const stats = {
    totalValue: Number(statsData?.totalValue) || 0,
    lowStockCount: Number(statsData?.lowStockCount) || 0,
    totalItems: Number(statsData?.totalItems) || 0
  };

  // 4. Passiamo i dati pronti al Client Component
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardClient initialStats={stats} />
    </Suspense>
  );
}