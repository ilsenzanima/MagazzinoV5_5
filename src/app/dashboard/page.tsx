import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();

  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString();

  const [
    activeJobsResult,
    recentDDTResult,
    monthDDTCountResult,
    recentPurchasesResult,
    monthPurchasesResult,
    lowStockResult,
  ] = await Promise.allSettled([
    // Commesse attive (top 8 più recenti)
    supabase
      .from("jobs")
      .select("id, code, name, status, site_address, clients(name)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(8),

    // Ultimi 5 DDT
    supabase
      .from("delivery_notes")
      .select(
        "id, type, number, date, created_at, jobs(code, name), delivery_note_items(quantity, inventory(name, unit))"
      )
      .order("created_at", { ascending: false })
      .limit(5),

    // Conteggio DDT del mese corrente
    supabase
      .from("delivery_notes")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfMonth),

    // Ultimi 5 acquisti
    supabase
      .from("purchases")
      .select(
        "id, delivery_note_number, delivery_note_date, created_at, suppliers(name), purchase_items(price, quantity)"
      )
      .order("created_at", { ascending: false })
      .limit(5),

    // Acquisti del mese (count + totale valore)
    supabase
      .from("purchases")
      .select("id, purchase_items(price, quantity)")
      .gte("created_at", startOfMonth),

    // Articoli in scorta minima (via RPC già esistente)
    supabase.rpc("get_dashboard_stats"),
  ]);

  // Commesse attive
  const activeJobs =
    activeJobsResult.status === "fulfilled"
      ? (activeJobsResult.value.data ?? [])
      : [];

  // DDT recenti
  const recentDDT =
    recentDDTResult.status === "fulfilled"
      ? (recentDDTResult.value.data ?? [])
      : [];

  // Conteggio DDT del mese
  const monthDDTCount =
    monthDDTCountResult.status === "fulfilled"
      ? (monthDDTCountResult.value.count ?? 0)
      : 0;

  // Acquisti recenti (arricchiti con totale)
  const recentPurchases =
    recentPurchasesResult.status === "fulfilled"
      ? (recentPurchasesResult.value.data ?? []).map((p: any) => ({
          ...p,
          totalAmount: (p.purchase_items ?? []).reduce(
            (sum: number, item: any) =>
              sum + (item.price || 0) * (item.quantity || 1),
            0
          ),
        }))
      : [];

  // Statistiche acquisti del mese
  const monthPurchasesRaw =
    monthPurchasesResult.status === "fulfilled"
      ? (monthPurchasesResult.value.data ?? [])
      : [];
  const monthPurchasesCount = monthPurchasesRaw.length;
  const monthPurchasesTotal = monthPurchasesRaw.reduce(
    (sum: number, p: any) =>
      sum +
      (p.purchase_items ?? []).reduce(
        (s: number, item: any) =>
          s + (item.price || 0) * (item.quantity || 1),
        0
      ),
    0
  );

  // Scorta minima dalla RPC esistente
  const lowStockCount =
    lowStockResult.status === "fulfilled"
      ? Number(lowStockResult.value.data?.lowStockCount ?? 0)
      : 0;

  const stats = {
    activeJobsCount: activeJobs.length,
    monthDDTCount,
    monthPurchasesCount,
    monthPurchasesTotal,
    lowStockCount,
  };

  return (
    <DashboardClient
      stats={stats}
      activeJobs={activeJobs}
      recentDDT={recentDDT}
      recentPurchases={recentPurchases}
    />
  );
}
