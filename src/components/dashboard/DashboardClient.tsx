"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { NotchTabs, NotchActions } from "@/components/ui/notch-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/components/auth-provider";
import { formatCurrency } from "@/lib/utils/format";
import {
  Search, Truck, ShoppingCart, Briefcase, FileText, HardHat, AlertTriangle, FileEdit, Hourglass, ChevronRight, type LucideIcon,
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
  onSiteJobs: { id: string; code: string; name: string; clients: { name: string } | null }[];
  todo: { draftDDTCount: number; pendingProposalsCount: number };
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

export const DashboardClient = memo(function DashboardClient({ stats, onSiteJobs, todo }: DashboardClientProps) {
  const router = useRouter();
  const { fullName, userRole } = useAuth();
  const canSeePrices = userRole === "admin" || userRole === "operativo";
  const firstName = fullName?.trim().split(/\s+/)[0] ?? "";
  const monthName = new Date().toLocaleString("it-IT", { month: "long" });
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("inventory");

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

          <div className="space-y-6">
            {/* Ricerca rapida */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-12 bg-white pl-10 text-base dark:bg-slate-900"
                  placeholder="Cerca articolo, commessa, fornitore…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") doSearch(); }}
                />
              </div>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="h-12 w-full bg-white sm:w-44 dark:bg-slate-900" aria-label="Dove cercare"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEARCH_SCOPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Azioni di tutti i giorni */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <QuickAction href="/movements/new" icon={Truck} label="Nuovo DDT" color="bg-blue-50 text-blue-600 dark:bg-blue-900/30" />
              <QuickAction href="/purchases/new" icon={ShoppingCart} label="Nuovo acquisto" color="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30" />
              {(userRole === "admin" || userRole === "operativo") && (
                <>
                  <QuickAction href="/jobs/new" icon={Briefcase} label="Nuova commessa" color="bg-violet-50 text-violet-600 dark:bg-violet-900/30" />
                  <QuickAction href="/proposals" icon={FileText} label="Nuova offerta" color="bg-amber-50 text-amber-600 dark:bg-amber-900/30" />
                </>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Le tue commesse: quelle segnate «in cantiere» */}
              <Card className="gap-0 py-0">
                <div className="flex items-center gap-2 border-b px-4 py-3">
                  <HardHat className="h-4 w-4 text-amber-500" />
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">In cantiere</h2>
                  <Link href="/jobs" className="ml-auto text-xs text-slate-400 hover:text-blue-600">Tutte le commesse</Link>
                </div>
                <div className="flex flex-wrap gap-2 p-4">
                  {onSiteJobs.length === 0 ? (
                    <p className="text-sm text-slate-400">Nessuna commessa in cantiere. Segna con l&apos;elmetto quelle su cui stai lavorando, nell&apos;elenco commesse.</p>
                  ) : onSiteJobs.map(j => (
                    <Link
                      key={j.id}
                      href={`/jobs/${j.id}`}
                      title={j.clients?.name ? `${j.name} · ${j.clients.name}` : j.name}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-950 transition-colors hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-100"
                    >
                      <HardHat className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-mono">{j.code}</span>
                      <span className="truncate text-amber-800/80 dark:text-amber-200/80">{j.name}</span>
                    </Link>
                  ))}
                </div>
              </Card>

              {/* Da fare */}
              <Card className="gap-0 overflow-hidden py-0">
                <div className="border-b px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Da fare</h2>
                </div>
                <TodoRow href="/inventory?tab=low_stock" icon={AlertTriangle} text="Articoli sotto scorta minima" count={stats.lowStockCount} alert />
                <TodoRow href="/movements" icon={FileEdit} text="Bozze di DDT da completare" count={todo.draftDDTCount} alert />
                <TodoRow href="/proposals" icon={Hourglass} text="Offerte in attesa di risposta" count={todo.pendingProposalsCount} />
              </Card>
            </div>
          </div>
        </NotchTabs>
      </div>
    </DashboardLayout>
  );
});
