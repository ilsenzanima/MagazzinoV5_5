import { createClient } from "@/lib/supabase/server";
import MovementsContent from "@/components/movements/MovementsContent";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { mapDbToDeliveryNote } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";

function MovementsSkeleton() {
  return (
    <div className="flex justify-center items-center py-12 h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <span className="ml-2 text-slate-500">Caricamento movimenti...</span>
    </div>
  );
}

export default async function MovementsPage() {
  const supabase = await createClient();

  // Fetch initial data (Page 1, Limit 12)
  const { data: dbMovements, error, count } = await supabase
    .from('delivery_notes')
    .select('*, jobs(code, description), delivery_note_items(quantity)', { count: 'estimated' })
    .order('date', { ascending: false })
    .range(0, 11);

  const initialMovements = dbMovements ? dbMovements.map((d: any) => ({
    ...mapDbToDeliveryNote(d),
    itemCount: d.delivery_note_items?.length || 0,
    totalQuantity: d.delivery_note_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
  })) : [];

  const initialTotalItems = count || 0;

  return (
    <DashboardLayout>
      <Suspense fallback={<MovementsSkeleton />}>
        <MovementsContent
          initialMovements={initialMovements}
          initialTotalItems={initialTotalItems}
        />
      </Suspense>
    </DashboardLayout>
  );
}
