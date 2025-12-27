import { createClient } from "@/lib/supabase/server";
import MovementDetailContent from "@/components/movements/MovementDetailContent";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { mapDbToDeliveryNote } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";

function MovementDetailSkeleton() {
  return (
    <div className="flex justify-center items-center py-12 h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-500">Caricamento dettagli movimento...</span>
    </div>
  );
}

export default async function MovementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  const { data, error } = await supabase
    .from('delivery_notes')
    .select(`
      *,
      jobs(code, description, site_address),
      delivery_note_items(
        *,
        inventory(name, code, unit, brand, category, description, price, model),
        purchase_items(price)
      )
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error("Movement not found or error", error);
    return (
        <DashboardLayout>
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold text-slate-900">Movimento non trovato</h2>
            </div>
        </DashboardLayout>
    );
  }

  const movement = mapDbToDeliveryNote(data);

  return (
    <DashboardLayout>
      <Suspense fallback={<MovementDetailSkeleton />}>
        <MovementDetailContent initialMovement={movement} />
      </Suspense>
    </DashboardLayout>
  );
}
