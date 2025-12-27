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

  // 2. Scarichiamo i dati direttamente prima di mostrare la pagina
  // Fetch Inventory for Counts
  const { data: inventory, error: invError } = await supabase
    .from('inventory')
    .select('quantity, min_stock');

  if (invError) {
    console.error("Errore caricamento dashboard (inventory):", invError);
  }

  // Fetch Batches for Value Calculation
  const { data: batches, error: batchError } = await supabase
    .from('purchase_batch_availability')
    .select('remaining_pieces, coefficient, unit_price');

  if (batchError) {
      console.error("Errore caricamento dashboard (batches):", batchError);
  }

  // 3. Calcoli lato server (più veloci e sicuri)
  let totalValue = 0;
  let lowStockCount = 0;
  const totalItems = inventory?.length || 0;

  // Calculate Value from Batches
  batches?.forEach(batch => {
      const pieces = Number(batch.remaining_pieces) || 0;
      const coeff = Number(batch.coefficient) || 1; 
      const price = Number(batch.unit_price) || 0;
      
      if (pieces > 0) {
          totalValue += (pieces * coeff) * price;
      }
  });

  // Calculate Low Stock
  inventory?.forEach(item => {
    if ((item.quantity || 0) <= (item.min_stock || 0)) {
      lowStockCount++;
    }
  });

  const stats = {
    totalValue,
    lowStockCount,
    totalItems
  };

  // 4. Passiamo i dati pronti al Client Component
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardClient initialStats={stats} />
    </Suspense>
  );
}