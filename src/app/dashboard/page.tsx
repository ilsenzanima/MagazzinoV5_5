import { createClient } from "@/lib/supabase/server";
import { getMissingDays } from "@/lib/services/attendance-check";
import { getAgendaDue } from "@/lib/services/agenda";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

type PurchaseRow = { purchase_items: { price: number | null; quantity: number | null }[] | null };

export default async function DashboardPage() {
  const supabase = await createClient();

  // Il mese si conta dalla data del documento (non da quando e' stato inserito): i documenti storici caricati
  // adesso non devono gonfiare i numeri del mese.
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const startOfMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfNextMonth = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01`;

  const [
    monthDDTCountResult,
    monthPurchasesResult,
    lowStockResult,
    activeJobsCountResult,
    loadNotesResult,
    draftsCountResult,
    pendingProposalsResult,
  ] = await Promise.allSettled([
    // Conteggio DDT del mese corrente
    supabase
      .from("delivery_notes")
      .select("id", { count: "exact", head: true })
      .gte("date", startOfMonth)
      .lt("date", startOfNextMonth),

    // Acquisti del mese (count + totale valore)
    supabase
      .from("purchases")
      .select("id, purchase_items(price, quantity)")
      .eq("order_type", "purchase")
      .is("deleted_at", null)
      .gte("delivery_note_date", startOfMonth)
      .lt("delivery_note_date", startOfNextMonth),

    // Articoli in scorta minima (via RPC già esistente)
    supabase.rpc("get_dashboard_stats"),

    // Numero reale delle commesse attive
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .is("deleted_at", null),

    // Note di carico da processare
    supabase
      .from("load_notes")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .is("deleted_at", null),

    // Bozze di DDT da completare
    supabase.from("delivery_note_drafts").select("id", { count: "exact", head: true }),

    // Offerte inviate o in attesa di risposta
    supabase
      .from("client_proposals")
      .select("id", { count: "exact", head: true })
      .in("status", ["sent", "pending"]),
  ]);

  const countOf = (r: PromiseSettledResult<{ count: number | null }>) =>
    r.status === "fulfilled" ? (r.value.count ?? 0) : 0;

  const monthPurchasesRaw: PurchaseRow[] =
    monthPurchasesResult.status === "fulfilled"
      ? ((monthPurchasesResult.value.data ?? []) as PurchaseRow[])
      : [];
  const monthPurchasesTotal = monthPurchasesRaw.reduce(
    (sum, p) =>
      sum +
      (p.purchase_items ?? []).reduce(
        (s, item) => s + (item.price || 0) * (item.quantity || 1),
        0
      ),
    0
  );

  const stats = {
    activeJobsCount: countOf(activeJobsCountResult),
    monthDDTCount: countOf(monthDDTCountResult),
    monthPurchasesCount: monthPurchasesRaw.length,
    monthPurchasesTotal,
    lowStockCount:
      lowStockResult.status === "fulfilled"
        ? Number(lowStockResult.value.data?.lowStockCount ?? 0)
        : 0,
  };

  let missingAttendanceDays = 0;
  try {
    missingAttendanceDays = (await getMissingDays(supabase)).length;
  } catch {
    missingAttendanceDays = 0;
  }

  let agendaDue = 0;
  try {
    const due = await getAgendaDue(supabase);
    agendaDue = due.reminders.length;
  } catch {
    agendaDue = 0;
  }

  const todo = {
    missingAttendanceDays,
    agendaDue,
    pendingLoadNotesCount: countOf(loadNotesResult),
    draftDDTCount: countOf(draftsCountResult),
    pendingProposalsCount: countOf(pendingProposalsResult),
  };

  return <DashboardClient stats={stats} todo={todo} />;
}
