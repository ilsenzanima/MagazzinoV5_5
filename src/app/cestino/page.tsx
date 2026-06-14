"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trash2, RotateCcw, Loader2, ShoppingCart, Receipt, ClipboardList,
  Users, Building2, Package, Briefcase, HardHat, Info, ShieldAlert
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { purchasesApi } from "@/lib/services/purchases";
import { invoicesApi } from "@/lib/services/invoices";
import { loadNotesService } from "@/lib/services/load-notes";
import { clientsApi } from "@/lib/services/clients";
import { suppliersApi } from "@/lib/services/suppliers";
import { inventoryApi } from "@/lib/services/inventory";
import { jobsApi } from "@/lib/services/jobs";
import { workersApi } from "@/lib/services/workers";

function daysUntilDeletion(deletedAt: string): number {
  const deletedDate = new Date(deletedAt);
  const expiresAt = new Date(deletedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const diffMs = expiresAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

interface TrashItem {
  id: string;
  label: string;
  sublabel?: string;
  deletedAt: string;
  deletedByName?: string | null;
}

interface TrashTableProps {
  items: TrashItem[];
  loading: boolean;
  onRestore: (id: string) => Promise<void>;
  emptyMessage: string;
}

function TrashTable({ items, loading, onRestore, emptyMessage }: TrashTableProps) {
  const [restoring, setRestoring] = useState<string | null>(null);

  const handleRestore = async (id: string) => {
    setRestoring(id);
    try {
      await onRestore(id);
    } finally {
      setRestoring(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-500">Caricamento cestino...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Trash2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {items.map((item) => {
        const days = daysUntilDeletion(item.deletedAt);
        return (
          <div key={item.id} className="flex items-center justify-between py-3 px-1 gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{item.label}</p>
              {item.sublabel && (
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{item.sublabel}</p>
              )}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-slate-400">
                  Eliminato il {formatDate(item.deletedAt)}
                  {item.deletedByName ? ` da ${item.deletedByName}` : ""}
                </span>
                <Badge
                  variant={days <= 3 ? "destructive" : days <= 7 ? "secondary" : "outline"}
                  className="text-xs"
                >
                  {days === 0 ? "Eliminazione definitiva oggi" : `${days} giorni al definitivo`}
                </Badge>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRestore(item.id)}
              disabled={restoring === item.id}
              className="shrink-0 gap-1.5"
            >
              {restoring === item.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              Ripristina
            </Button>
          </div>
        );
      })}
    </div>
  );
}

type SectionKey = "purchases" | "invoices" | "load-notes" | "clients" | "suppliers" | "inventory" | "jobs" | "workers";

interface SectionState {
  items: TrashItem[];
  loading: boolean;
}

export default function CestinoPage() {
  const { userRole } = useAuth();

  const [sections, setSections] = useState<Record<SectionKey, SectionState>>(() => ({
    purchases: { items: [], loading: false },
    invoices: { items: [], loading: false },
    "load-notes": { items: [], loading: false },
    clients: { items: [], loading: false },
    suppliers: { items: [], loading: false },
    inventory: { items: [], loading: false },
    jobs: { items: [], loading: false },
    workers: { items: [], loading: false },
  }));

  const loadSection = useCallback(async (key: SectionKey) => {
    setSections((prev: Record<SectionKey, SectionState>) => ({ ...prev, [key]: { ...prev[key], loading: true } }));
    try {
      let items: TrashItem[] = [];

      if (key === "purchases") {
        const data = await purchasesApi.getDeleted();
        items = data.map((p: any) => ({
          id: p.id,
          label: `Bolla: ${p.deliveryNoteNumber || "—"}`,
          sublabel: p.supplierName,
          deletedAt: p.deletedAt,
          deletedByName: p.deletedByName,
        }));
      } else if (key === "invoices") {
        const data = await invoicesApi.getDeleted();
        items = data.map((i: any) => ({
          id: i.id,
          label: `Fattura: ${i.invoiceNumber || "—"}`,
          sublabel: i.supplierName,
          deletedAt: i.deletedAt,
          deletedByName: i.deletedByName,
        }));
      } else if (key === "load-notes") {
        const data = await loadNotesService.getDeleted();
        items = data.map((n: any) => ({
          id: n.id,
          label: `Bolla ${n.noteType === "uscita" ? "uscita" : "reso"} — ${n.date}`,
          sublabel: n.jobCode ? `Commessa: ${n.jobCode}` : n.notes,
          deletedAt: n.deletedAt,
          deletedByName: n.deletedByName,
        }));
      } else if (key === "clients") {
        const data = await clientsApi.getDeleted();
        items = data.map((c: any) => ({
          id: c.id,
          label: c.name,
          sublabel: c.city || c.email,
          deletedAt: c.deletedAt,
          deletedByName: c.deletedByName,
        }));
      } else if (key === "suppliers") {
        const data = await suppliersApi.getDeleted();
        items = data.map((s: any) => ({
          id: s.id,
          label: s.name,
          sublabel: s.email || s.phone,
          deletedAt: s.deletedAt,
          deletedByName: s.deletedByName,
        }));
      } else if (key === "inventory") {
        const data = await inventoryApi.getDeleted();
        items = data.map((i: any) => ({
          id: i.id,
          label: i.name,
          sublabel: [i.brand, i.model].filter(Boolean).join(" — "),
          deletedAt: i.deletedAt,
          deletedByName: i.deletedByName,
        }));
      } else if (key === "jobs") {
        const data = await jobsApi.getDeleted();
        items = data.map((j: any) => ({
          id: j.id,
          label: `${j.code} — ${j.name}`,
          sublabel: j.clientName,
          deletedAt: j.deletedAt,
          deletedByName: j.deletedByName,
        }));
      } else if (key === "workers") {
        const data = await workersApi.getDeleted();
        items = data.map((w: any) => ({
          id: w.id,
          label: `${w.lastName} ${w.firstName}`,
          sublabel: w.email,
          deletedAt: w.deletedAt,
          deletedByName: w.deletedByName,
        }));
      }

      setSections((prev: Record<SectionKey, SectionState>) => ({ ...prev, [key]: { items, loading: false } }));
    } catch (err) {
      console.error(`Error loading trash for ${key}:`, err);
      setSections((prev: Record<SectionKey, SectionState>) => ({ ...prev, [key]: { items: [], loading: false } }));
    }
  }, []);

  useEffect(() => {
    if (userRole !== "admin") return;
    const keys: SectionKey[] = ["purchases", "invoices", "load-notes", "clients", "suppliers", "inventory", "jobs", "workers"];
    keys.forEach(loadSection);
  }, [userRole, loadSection]);

  const [purging, setPurging] = useState(false)
  const [purgeResult, setPurgeResult] = useState<string | null>(null)

  const handlePurge = async () => {
    if (!confirm("Eliminare definitivamente tutti gli elementi scaduti (>30 giorni)? I file allegati verranno rimossi da storage. Azione irreversibile.")) return
    setPurging(true)
    setPurgeResult(null)
    try {
      const res = await fetch('/api/purge-trash', {
        method: 'POST',
        headers: { 'x-purge-secret': process.env.NEXT_PUBLIC_PURGE_SECRET || '' }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const total = data.total ?? 0
      setPurgeResult(total === 0 ? "Nessun elemento scaduto da eliminare." : `Eliminati definitivamente ${total} elementi.`)
      const keys: SectionKey[] = ["purchases", "invoices", "load-notes", "clients", "suppliers", "inventory", "jobs", "workers"]
      keys.forEach(loadSection)
    } catch (e: any) {
      setPurgeResult("Errore: " + e.message)
    } finally {
      setPurging(false)
    }
  }

  const makeRestorer = (key: SectionKey, restoreFn: (id: string) => Promise<void>) =>
    async (id: string) => {
      await restoreFn(id);
      await loadSection(key);
    };

  if (userRole !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 text-slate-500">
          <Trash2 className="h-12 w-12 opacity-20 mb-4" />
          <p>Accesso riservato agli amministratori.</p>
        </div>
      </DashboardLayout>
    );
  }

  const tabs = [
    { key: "purchases" as SectionKey, label: "Acquisti", icon: ShoppingCart },
    { key: "invoices" as SectionKey, label: "Fatture", icon: Receipt },
    { key: "load-notes" as SectionKey, label: "Note Carico", icon: ClipboardList },
    { key: "clients" as SectionKey, label: "Clienti", icon: Users },
    { key: "suppliers" as SectionKey, label: "Fornitori", icon: Building2 },
    { key: "inventory" as SectionKey, label: "Inventario", icon: Package },
    { key: "jobs" as SectionKey, label: "Commesse", icon: Briefcase },
    { key: "workers" as SectionKey, label: "Operai", icon: HardHat },
  ];

  const totalCount = Object.values(sections).reduce((sum, s) => sum + s.items.length, 0);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Trash2 className="h-6 w-6 text-slate-600 dark:text-slate-400" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cestino</h1>
            {totalCount > 0 && (
              <Badge variant="secondary">{totalCount} elementi</Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            Gli elementi vengono eliminati definitivamente dopo 30 giorni. Solo gli admin possono ripristinarli.
          </p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
              onClick={handlePurge}
              disabled={purging}
            >
              {purging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              Purga elementi scaduti
            </Button>
            {purgeResult && <span className="text-xs text-slate-500">{purgeResult}</span>}
          </div>
        </div>

        <Tabs defaultValue="purchases">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 dark:bg-muted p-1">
            {tabs.map(({ key, label, icon: Icon }) => (
              <TabsTrigger key={key} value={key} className="gap-1.5 text-xs sm:text-sm">
                <Icon className="h-3.5 w-3.5" />
                {label}
                {sections[key].items.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {sections[key].items.length}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="purchases" className="mt-4">
            <TrashTable
              items={sections.purchases.items}
              loading={sections.purchases.loading}
              onRestore={makeRestorer("purchases", purchasesApi.restore)}
              emptyMessage="Nessun acquisto nel cestino"
            />
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            <TrashTable
              items={sections.invoices.items}
              loading={sections.invoices.loading}
              onRestore={makeRestorer("invoices", invoicesApi.restore)}
              emptyMessage="Nessuna fattura nel cestino"
            />
          </TabsContent>

          <TabsContent value="load-notes" className="mt-4">
            <TrashTable
              items={sections["load-notes"].items}
              loading={sections["load-notes"].loading}
              onRestore={makeRestorer("load-notes", loadNotesService.restore)}
              emptyMessage="Nessuna nota di carico nel cestino"
            />
          </TabsContent>

          <TabsContent value="clients" className="mt-4">
            <TrashTable
              items={sections.clients.items}
              loading={sections.clients.loading}
              onRestore={makeRestorer("clients", clientsApi.restore)}
              emptyMessage="Nessun cliente nel cestino"
            />
          </TabsContent>

          <TabsContent value="suppliers" className="mt-4">
            <TrashTable
              items={sections.suppliers.items}
              loading={sections.suppliers.loading}
              onRestore={makeRestorer("suppliers", suppliersApi.restore)}
              emptyMessage="Nessun fornitore nel cestino"
            />
          </TabsContent>

          <TabsContent value="inventory" className="mt-4">
            <TrashTable
              items={sections.inventory.items}
              loading={sections.inventory.loading}
              onRestore={makeRestorer("inventory", inventoryApi.restore)}
              emptyMessage="Nessun articolo nel cestino"
            />
          </TabsContent>

          <TabsContent value="jobs" className="mt-4">
            <TrashTable
              items={sections.jobs.items}
              loading={sections.jobs.loading}
              onRestore={makeRestorer("jobs", jobsApi.restore)}
              emptyMessage="Nessuna commessa nel cestino"
            />
          </TabsContent>

          <TabsContent value="workers" className="mt-4">
            <TrashTable
              items={sections.workers.items}
              loading={sections.workers.loading}
              onRestore={makeRestorer("workers", workersApi.restore)}
              emptyMessage="Nessun operaio nel cestino"
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
