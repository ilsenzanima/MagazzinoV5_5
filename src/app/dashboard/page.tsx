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
  const supabase = await createClient();

  // Fetch all data in parallel for performance
  const [statsResult, movementsResult, jobsResult] = await Promise.allSettled([
    supabase.rpc('get_dashboard_stats'),
    supabase
      .from('delivery_notes')
      .select(`
        id,
        type,
        number,
        date,
        created_at,
        jobs(code, description),
        delivery_note_items(
          quantity,
          inventory(name, model, unit)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('jobs').select('status')
  ]);

  // Process Stats
  const statsData = statsResult.status === 'fulfilled' ? statsResult.value.data : null;
  if (statsResult.status === 'rejected') console.error("Error fetching stats:", statsResult.reason);

  const stats = {
    totalValue: Number(statsData?.totalValue) || 0,
    lowStockCount: Number(statsData?.lowStockCount) || 0,
    totalItems: Number(statsData?.totalItems) || 0
  };

  // Process Movements
  const recentMovements = movementsResult.status === 'fulfilled' && movementsResult.value.data
    ? movementsResult.value.data
    : [];
  if (movementsResult.status === 'rejected') console.error("Error fetching movements:", movementsResult.reason);

  // Process Jobs Stats
  const jobsData = jobsResult.status === 'fulfilled' ? jobsResult.value.data : [];
  if (jobsResult.status === 'rejected') console.error("Error fetching jobs:", jobsResult.reason);

  const jobStats = (jobsData || []).reduce((acc, job) => {
    const status = job.status as 'active' | 'completed' | 'suspended';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, { active: 0, completed: 0, suspended: 0, total: (jobsData?.length || 0) });

  // Eplicitly add total if not calculated above (reduce implementation above doesn't add total property to acc except initial)
  // Fix: The reduce above accumulates into {active, completed, suspended}, we need to add total separately or include it.
  const finalJobStats = {
    active: jobStats.active || 0,
    completed: jobStats.completed || 0,
    suspended: jobStats.suspended || 0,
    total: jobsData?.length || 0
  };

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardClient
        initialStats={stats}
        recentMovements={recentMovements}
        jobStats={finalJobStats}
      />
    </Suspense>
  );
}