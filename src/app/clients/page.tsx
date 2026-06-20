"use client"

import { useState, useEffect, useDeferredValue } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Plus,
  Loader2,
  Building2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { Client, clientsApi } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/components/auth-provider";
import { ClientCard } from "@/components/clients";
import { ViewToggle } from "@/components/ui/view-toggle";
import { useViewMode } from "@/hooks/useViewMode";

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function ClientsPage() {
  const { userRole } = useAuth();
  const [viewMode, setViewMode] = useViewMode('committenti');
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDeferredValue(searchTerm);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const LIMIT = 24;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeLetter]);

  useEffect(() => {
    loadClients();
  }, [page, debouncedSearch, activeLetter]);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, total } = await clientsApi.getPaginated({
        page,
        limit: LIMIT,
        search: debouncedSearch,
        letter: activeLetter || undefined,
      });
      setClients(data);
      setTotalItems(total);
    } catch (error: any) {
      console.error("Failed to load clients:", error);
      setError(error.message || "Errore sconosciuto durante il caricamento");
    } finally {
      setLoading(false);
    }
  };

  const handleLetterClick = (letter: string) => {
    setActiveLetter(prev => prev === letter ? null : letter);
    setSearchTerm("");
  };

  const canEdit = userRole === 'admin' || userRole === 'operativo';
  const totalPages = Math.ceil(totalItems / LIMIT);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="bg-white dark:bg-card p-4 shadow-sm sticky top-0 z-10 space-y-4 rounded-lg mb-6 border dark:border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Gestione Committenti</h1>
          {canEdit && (
            <Link href="/clients/new">
              <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Nuovo Committente
              </Button>
            </Link>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Cerca Committente (Nome, P.IVA, Email...)"
              className="pl-9 bg-slate-100 dark:bg-muted border-none"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value) setActiveLetter(null);
              }}
            />
          </div>
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>

        {/* Alphabet quick-select (mobile, horizontal scroll) */}
        <div className="flex sm:hidden gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {activeLetter && (
            <button
              onClick={() => setActiveLetter(null)}
              className="shrink-0 w-7 h-7 text-xs font-semibold rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Rimuovi filtro"
            >
              ✕
            </button>
          )}
          {ALPHABET.map(letter => (
            <button
              key={letter}
              onClick={() => handleLetterClick(letter)}
              className={`shrink-0 w-7 h-7 text-xs font-semibold rounded transition-colors ${
                activeLetter === letter
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600'
              }`}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento committenti...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col justify-center items-center py-12 text-center">
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-full mb-4">
            <Building2 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Errore di Caricamento</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">{error}</p>
          <Button onClick={loadClients} variant="outline">
            Riprova
          </Button>
        </div>
      ) : (
        <div className="flex gap-3">
          {/* Client Grid */}
          <div className="flex-1 min-w-0">
            {clients.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                <Building2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nessun committente trovato{activeLetter ? ` con la lettera "${activeLetter}"` : ''}</p>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-1.5">
                {clients.map((client) => {
                  const addressLine = [
                    client.street ? `${client.street}${client.streetNumber ? ' ' + client.streetNumber : ''}` : '',
                    client.postalCode || '',
                    client.city || '',
                    client.province ? `(${client.province.toUpperCase()})` : '',
                  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').replace(/ ,/g, ',').trim();
                  return (
                    <Link href={`/clients/${client.id}`} key={client.id}>
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-card border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-sm hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer">
                        <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                        <span className="font-semibold text-slate-900 dark:text-white text-sm w-48 shrink-0 truncate">
                          {client.name}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 text-xs flex-1 truncate hidden sm:block">
                          {addressLine || '—'}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {clients.map((client) => (
                  <ClientCard key={client.id} client={client} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Pagina {page} di {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Alphabet Sidebar */}
          <div className="hidden sm:flex flex-col gap-0.5 sticky top-40 h-fit self-start shrink-0">
            {activeLetter && (
              <button
                onClick={() => setActiveLetter(null)}
                className="w-7 h-5 text-[10px] font-semibold rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mb-1"
                title="Rimuovi filtro"
              >
                ✕
              </button>
            )}
            {ALPHABET.map(letter => (
              <button
                key={letter}
                onClick={() => handleLetterClick(letter)}
                className={`w-7 h-6 text-xs font-semibold rounded transition-colors ${
                  activeLetter === letter
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
