import { createClient } from "@/lib/supabase/server";
import InventoryClient from "@/components/inventory/InventoryClient";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { mapDbItemToInventoryItem } from "@/lib/api";

// Skeleton Component
function InventorySkeleton() {
  return (
    <div className="flex justify-center items-center py-12 h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <span className="ml-2 text-slate-500">Caricamento inventario...</span>
    </div>
  );
}

export default async function InventoryPage() {
  const supabase = await createClient();

  // Fetch initial data (Page 1, Limit 12, Tab 'all')
  const { data: dbItems, error, count } = await supabase
    .from('inventory')
    .select('*', { count: 'estimated' })
    .order('name')
    .range(0, 11); // 0 to 11 is 12 items

  // Fetch item types for images/filtering
  const { data: dbTypes } = await supabase
    .from('item_types')
    .select('*')
    .order('name');

  const initialItems = dbItems ? dbItems.map(mapDbItemToInventoryItem) : [];
  const initialTotal = count || 0;

  const initialTypes = dbTypes?.map(t => ({
    id: t.id,
    name: t.name,
    imageUrl: t.image_url
  })) || [];

  return (
    <Suspense fallback={<InventorySkeleton />}>
      <InventoryClient
        initialItems={initialItems}
        initialTotal={initialTotal}
        initialTypes={initialTypes}
      />
    </Suspense>
  );
}
