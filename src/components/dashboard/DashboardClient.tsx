"use client";

import { memo, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { NotchTabs, NotchActions } from "@/components/ui/notch-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-provider";
import { formatCurrency } from "@/lib/utils/format";
import {
  Search, Loader2, Truck, ShoppingCart, Briefcase, FileText, AlertTriangle, FileEdit, Hourglass, ClipboardList, ChevronRight, CalendarX, CalendarDays, type LucideIcon,
} from "lucide-react";

interface DashboardStats {
  activeJobsCount: number;
  monthDDTCount: number;
  monthPurchasesCount: number;
  monthPurchasesTotal: number;
  lowStockCount: number;
}

interface DashboardClientProps {
  stats: DashboardStats;
  todo: { draftDDTCount: number; pendingProposalsCount: number; pendingLoadNotesCount: number; missingAttendanceDays: number; agendaDue: number };
}

// Saluto in base all'ora del giorno; di sera e di notte con una battuta
function greeting(hour: number, name: string) {
  const n = name ? `, ${name}` : "";
  if (hour >= 5 && hour < 13) return `Buongiorno${n}`;
  if (hour >= 13 && hour < 18) return `Buon pomeriggio${n}`;
  if (hour >= 18) return `Buonasera${n}, ancora al lavoro?`;
  return name ? `${name}, vai a dormire! Buonanotte` : "Vai a dormire! Buonanotte";
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

function QuickAction({ href, icon: Icon, label, color }: { href: string; icon: LucideIcon; label: string; color: string }) {
  return (
    <Link href={href}>
      <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
        <CardContent className="flex flex-col items-center gap-2 px-3 py-5 text-center">
          <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}><Icon className="h-6 w-6" /></span>
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}

function TodoRow({ href, icon: Icon, text, count, alert }: { href: string; icon: LucideIcon; text: string; count: number; alert?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <Icon className={`h-4 w-4 shrink-0 ${count > 0 && alert ? "text-amber-500" : "text-slate-400"}`} />
      <span className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200">{text}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${count > 0 ? (alert ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800") : "bg-slate-100 text-slate-400"}`}>{count}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
    </Link>
  );
}

const SEARCH_SCOPES: { value: string; label: string; path: string }[] = [
  { value: "inventory", label: "Articoli", path: "/inventory" },
  { value: "jobs", label: "Commesse", path: "/jobs" },
  { value: "suppliers", label: "Fornitori", path: "/suppliers" },
  { value: "clients", label: "Committenti", path: "/clients" },
  { value: "proposals", label: "Offerte", path: "/proposals" },
  { value: "purchases", label: "Acquisti", path: "/purchases" },
];

interface SearchHit { id: string; title: string; sub?: string; href: string }

// Risultati mentre si scrive: pochi, per capire al volo se e' quello che cerchi
async function searchHits(scope: string, raw: string): Promise<SearchHit[]> {
  const q = raw.replace(/[,()%*]/g, " ").trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  switch (scope) {
    case "inventory": {
      const { data } = await supabase.from("inventory").select("id, code, name, brand").is("deleted_at", null)
        .or(`name.ilike.${like},code.ilike.${like},brand.ilike.${like}`).limit(8);
      return (data ?? []).map((r: any) => ({ id: r.id, title: r.name, sub: [r.code, r.brand].filter(Boolean).join(" · "), href: `/inventory/${r.id}` }));
    }
    case "jobs": {
      const { data } = await supabase.from("jobs").select("id, code, name, clients(name)").is("deleted_at", null)
        .or(`name.ilike.${like},code.ilike.${like}`).limit(8);
      return (data ?? []).map((r: any) => ({ id: r.id, title: r.name, sub: [r.code, r.clients?.name].filter(Boolean).join(" · "), href: `/jobs/${r.id}` }));
    }
    case "suppliers": {
      const { data } = await supabase.from("suppliers").select("id, name").is("deleted_at", null).ilike("name", like).limit(8);
      return (data ?? []).map((r: any) => ({ id: r.id, title: r.name, href: `/suppliers/${r.id}` }));
    }
    case "clients": {
      const { data } = await supabase.from("clients").select("id, name").is("deleted_at", null).ilike("name", like).limit(8);
      return (data ?? []).map((r: any) => ({ id: r.id, title: r.name, href: `/clients/${r.id}` }));
    }
    case "proposals": {
      const { data } = await supabase.from("client_proposals").select("id, title, client_id, clients(name)").is("deleted_at", null).ilike("title", like).limit(8);
      return (data ?? []).map((r: any) => ({ id: r.id, title: r.title, sub: r.clients?.name, href: `/clients/${r.client_id}/proposals/${r.id}` }));
    }
    case "purchases": {
      // Si cerca sia per numero DDT sia per nome del fornitore
      const { data: sup } = await supabase.from("suppliers").select("id").is("deleted_at", null).ilike("name", like).limit(30);
      const supIds = (sup ?? []).map((s: any) => s.id);
      const orFilter = supIds.length > 0
        ? `delivery_note_number.ilike.${like},supplier_id.in.(${supIds.join(",")})`
        : `delivery_note_number.ilike.${like}`;
      const { data } = await supabase.from("purchases").select("id, delivery_note_number, suppliers(name)").eq("order_type", "purchase").is("deleted_at", null)
        .or(orFilter).order("created_at", { ascending: false }).limit(8);
      return (data ?? []).map((r: any) => ({ id: r.id, title: `DDT ${r.delivery_note_number}`, sub: r.suppliers?.name, href: `/purchases/${r.id}` }));
    }
    default:
      return [];
  }
}

export const DashboardClient = memo(function DashboardClient({ stats, todo }: DashboardClientProps) {
  const router = useRouter();
  const { fullName, userRole } = useAuth();
  const canSeePrices = userRole === "admin" || userRole === "operativo";
  const firstName = fullName?.trim().split(/\s+/)[0] ?? "";
  const monthName = new Date().toLocaleString("it-IT", { month: "long" });
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("inventory");

  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) { setHits([]); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchHits(scope, query);
        if (!cancelled) setHits(res);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, scope]);

  const doSearch = () => {
    const q = query.trim();
    const path = SEARCH_SCOPES.find(s => s.value === scope)?.path ?? "/inventory";
    router.push(q ? `${path}?q=${encodeURIComponent(q)}` : path);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1700px] space-y-6 pb-8">
        {/* Saluto */}
        <h1 className="px-2 text-center text-lg font-semibold text-slate-800 dark:text-slate-100 md:text-2xl" suppressHydrationWarning>
          {greeting(new Date().getHours(), firstName)}
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Sinistra: ricerca rapida (barra in evidenza, sotto si sceglie dove cercare) */}
            <div className="space-y-3">
              {/* Bordo sfumato: rosso che sfuma in arancio e rosa; l'alone compare solo quando ci si clicca per scrivere */}
              <div className="group relative rounded-xl bg-gradient-to-r from-red-400/80 via-orange-300/70 to-rose-400/80 p-[2px] transition-shadow focus-within:shadow-[0_0_0_4px_rgba(251,113,133,0.18),0_4px_16px_rgba(244,63,94,0.28)]">
                <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-6 w-6 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-14 rounded-[10px] border-0 bg-white pl-12 text-lg shadow-none focus-visible:ring-0 dark:bg-slate-900"
                  placeholder="Cerca…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") doSearch(); }}
                  aria-label="Ricerca rapida"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">Cerca in</span>
                {SEARCH_SCOPES.map(sc => (
                  <button
                    key={sc.value}
                    type="button"
                    onClick={() => setScope(sc.value)}
                    aria-pressed={scope === sc.value}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${scope === sc.value ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>

              {/* Risultati mentre si scrive */}
              {query.trim().length >= 2 && (
                <Card className="gap-0 overflow-hidden py-0">
                  {searching && hits.length === 0 ? (
                    <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Cerco…</div>
                  ) : hits.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-400">Nessun risultato in «{SEARCH_SCOPES.find(sc => sc.value === scope)?.label}».</p>
                  ) : (
                    <>
                      {hits.map(h => (
                        <Link key={h.id} href={h.href} className="flex items-center gap-3 border-b px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{h.title}</span>
                            {h.sub && <span className="block truncate text-xs text-slate-500">{h.sub}</span>}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                        </Link>
                      ))}
                      <button type="button" onClick={doSearch} className="w-full px-4 py-2.5 text-left text-xs font-medium text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        Vedi tutti i risultati
                      </button>
                    </>
                  )}
                </Card>
              )}
            </div>

            {/* Destra: azioni rapide e cose da fare */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                <QuickAction href="/movements/new" icon={Truck} label="Nuovo DDT" color="bg-blue-50 text-blue-600 dark:bg-blue-900/30" />
                <QuickAction href="/purchases/new" icon={ShoppingCart} label="Nuovo acquisto" color="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30" />
                {(userRole === "admin" || userRole === "operativo") && (
                  <>
                    <QuickAction href="/jobs/new" icon={Briefcase} label="Nuova commessa" color="bg-violet-50 text-violet-600 dark:bg-violet-900/30" />
                    <QuickAction href="/proposals" icon={FileText} label="Nuova offerta" color="bg-amber-50 text-amber-600 dark:bg-amber-900/30" />
                  </>
                )}
              </div>

              <Card className="gap-0 overflow-hidden py-0">
                <div className="border-b px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Da fare</h2>
                </div>
                <TodoRow href="/load-notes" icon={ClipboardList} text="Note di carico da processare" count={todo.pendingLoadNotesCount} alert />
                <TodoRow href="/inventory?tab=low_stock" icon={AlertTriangle} text="Articoli sotto scorta minima" count={stats.lowStockCount} alert />
                <TodoRow href="/movements" icon={FileEdit} text="Bozze di DDT da completare" count={todo.draftDDTCount} alert />
                {(userRole === "admin" || userRole === "operativo") && (
                  <TodoRow href="/agenda" icon={CalendarDays} text="Agenda: voci di oggi o da ricordare" count={todo.agendaDue} alert />
                )}
                {(userRole === "admin" || userRole === "operativo") && (
                  <TodoRow href="/attendance" icon={CalendarX} text="Giorni con presenze da segnare" count={todo.missingAttendanceDays} alert />
                )}
                <TodoRow href="/proposals" icon={Hourglass} text="Offerte in attesa di risposta" count={todo.pendingProposalsCount} />
              </Card>
            </div>
          </div>
        </NotchTabs>
      </div>
    </DashboardLayout>
  );
});
