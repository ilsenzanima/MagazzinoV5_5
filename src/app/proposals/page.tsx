"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ViewToggle } from "@/components/ui/view-toggle";
import { Loader2, Search, MapPin, FileText, Users } from "lucide-react";
import { clientProposalsApi, ClientProposal, ProposalStatus } from "@/lib/services/client-proposals";
import { notify } from "@/lib/notify";
import { useAuth } from "@/components/auth-provider";
import { useViewMode } from "@/hooks/useViewMode";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const PROP_STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: "Bozza", sent: "Inviata", pending: "In attesa", accepted: "Accettata", rejected: "Rifiutata",
};
const PROP_STATUS_COLORS: Record<ProposalStatus, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

type ProposalWithClient = ClientProposal & { clientName: string };

export default function ProposalsPage() {
  const { userRole } = useAuth();
  const router = useRouter();
  const [viewMode, setViewMode] = useViewMode("proposte");

  const [proposals, setProposals] = useState<ProposalWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  useEffect(() => {
    if (userRole && userRole !== "admin" && userRole !== "operativo") {
      router.push("/dashboard");
      return;
    }
    if (userRole) load();
  }, [userRole]);

  const load = async () => {
    try {
      setLoading(true);
      setProposals(await clientProposalsApi.getAll());
    } catch {
      notify.error("Errore caricamento proposte");
    } finally {
      setLoading(false);
    }
  };

  const clientNames = useMemo(() => {
    const names = [...new Set(proposals.map(p => p.clientName).filter(Boolean))];
    return names.sort((a, b) => a.localeCompare(b, "it"));
  }, [proposals]);

  const filtered = useMemo(() => {
    return proposals.filter(p => {
      const s = search.toLowerCase();
      const matchSearch = !s ||
        p.title.toLowerCase().includes(s) ||
        p.clientName.toLowerCase().includes(s) ||
        (p.siteCity && p.siteCity.toLowerCase().includes(s));
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchClient = clientFilter === "all" || p.clientName === clientFilter;
      return matchSearch && matchStatus && matchClient;
    });
  }, [proposals, search, statusFilter, clientFilter]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Elenco Proposte</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Tutte le proposte di tutti i committenti</p>
        </div>

        {/* Filtri + toggle */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Cerca per titolo, committente, città..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Tutti i committenti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i committenti</SelectItem>
              {clientNames.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tutti gli stati" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              {(Object.entries(PROP_STATUS_LABELS) as [ProposalStatus, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>

        {/* Conteggio */}
        {!loading && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filtered.length} proposta{filtered.length !== 1 ? "e" : ""} trovata{filtered.length !== 1 ? "e" : ""}
            {filtered.length !== proposals.length && ` (su ${proposals.length} totali)`}
          </p>
        )}

        {/* Contenuto */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>{proposals.length === 0 ? "Nessuna proposta presente." : "Nessuna proposta corrisponde ai filtri."}</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-1.5">
            {filtered.map(p => (
              <Link key={p.id} href={`/clients/${p.clientId}/proposals/${p.id}`}>
                <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-card border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-sm hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer">
                  <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="font-medium text-slate-900 dark:text-white text-sm flex-1 min-w-0 truncate">
                    {p.title}
                  </span>
                  <span className="text-blue-700 dark:text-blue-400 text-xs w-44 shrink-0 truncate hidden sm:flex items-center gap-1">
                    <Users className="h-3 w-3 shrink-0" />{p.clientName}
                  </span>
                  {p.estimatedValue !== null && (
                    <span className="text-slate-600 dark:text-slate-300 text-xs w-28 shrink-0 text-right hidden md:block">
                      € {p.estimatedValue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  {(p.siteCity || p.siteStreet) && (
                    <span className="text-slate-400 text-xs w-36 shrink-0 truncate hidden lg:flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />{[p.siteStreet, p.siteCity].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {p.date && (
                    <span className="text-slate-400 text-xs w-24 shrink-0 hidden xl:block">
                      {format(new Date(p.date), "d MMM yyyy", { locale: it })}
                    </span>
                  )}
                  <Badge className={`text-xs shrink-0 ${PROP_STATUS_COLORS[p.status]}`} variant="secondary">
                    {PROP_STATUS_LABELS[p.status]}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(p => (
              <Link key={p.id} href={`/clients/${p.clientId}/proposals/${p.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-900 dark:text-white leading-snug">{p.title}</p>
                      <Badge className={`text-xs shrink-0 ${PROP_STATUS_COLORS[p.status]}`} variant="secondary">
                        {PROP_STATUS_LABELS[p.status]}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">{p.clientName}</p>
                    {p.estimatedValue !== null && (
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        € {p.estimatedValue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </p>
                    )}
                    {p.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">{p.description}</p>
                    )}
                    {(p.siteCity || p.siteStreet) && (
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>{[p.siteStreet, p.siteCity].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                    {p.date && (
                      <p className="text-xs text-slate-400">
                        {format(new Date(p.date), "d MMM yyyy", { locale: it })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
