"use client"

import { notify } from "@/lib/notify";;

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Loader2, FileText, ArrowDownRight, ArrowUpRight, ShoppingBag, Truck, Calendar, Printer, Recycle } from "lucide-react";
import { PaginationControls } from "@/components/ui/pagination-controls";
import Link from "next/link";
import { useState, useEffect, useDeferredValue } from "react";
import { deliveryNotesApi, DeliveryNote, DeliveryNoteItem } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/components/auth-provider";
import { ViewToggle } from "@/components/ui/view-toggle";
import { useViewMode } from "@/hooks/useViewMode";
import { PageSizeSelector } from "@/components/ui/page-size-selector";
import { usePageSize } from "@/hooks/usePageSize";
interface MovementsContentProps {
  initialMovements: DeliveryNote[];
  initialTotalItems: number;
}

export default function MovementsContent({ initialMovements, initialTotalItems }: MovementsContentProps) {
  const { userRole } = useAuth();
  const [viewMode, setViewMode] = useViewMode('movimentazioni');
  const [pageSize, setPageSize] = usePageSize('movimentazioni');
  const ITEMS_PER_PAGE = pageSize;
  const initialTotalPages = Math.ceil(initialTotalItems / ITEMS_PER_PAGE);

  const [movements, setMovements] = useState<DeliveryNote[]>(initialMovements);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Search state
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);

  // Track if it's the first render to avoid fetching what we already have
  const [isFirstRender, setIsFirstRender] = useState(true);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, dateFrom, dateTo, pageSize]);

  useEffect(() => {
    // Skip the first load only if we have SSR data AND the page size matches what was pre-fetched (12)
    if (isFirstRender && page === 1 && deferredSearch === "" && !dateFrom && !dateTo && pageSize === 12) {
      setIsFirstRender(false);
      return;
    }

    loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, deferredSearch, dateFrom, dateTo, pageSize]);

  // Helper to extract numeric part from delivery note number (e.g., "4/PP26" -> 4)
  const extractBollaNumber = (number: string): number => {
    const match = number?.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Sort movements by date (desc) then by bolla number (desc)
  const sortMovements = (data: DeliveryNote[]): DeliveryNote[] => {
    return [...data].sort((a, b) => {
      // First compare by date (descending)
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateB - dateA;

      // If same date, compare by bolla number (descending)
      const numA = extractBollaNumber(a.number);
      const numB = extractBollaNumber(b.number);
      return numB - numA;
    });
  };

  const loadMovements = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, total } = await deliveryNotesApi.getPaginated({
        page,
        limit: ITEMS_PER_PAGE,
        search: deferredSearch,
        dateFrom,
        dateTo,
      });

      // Sort client-side for proper numeric ordering
      setMovements(sortMovements(data));
      setTotalPages(Math.ceil(total / ITEMS_PER_PAGE));
    } catch (error: any) {
      console.error("Failed to load movements", error);
      setError(error.message || "Errore durante il caricamento dei movimenti");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1); // Reset page on search
  };

  const getTypeConfig = (movement: DeliveryNote) => {
    if (movement.type === 'waste') {
      return { label: 'Eccedenze', color: 'bg-violet-100 text-violet-700 hover:bg-violet-100', icon: Recycle };
    }

    switch (movement.type) {
      case 'entry':
        return { label: 'Entrata', color: 'bg-green-100 text-green-700 hover:bg-green-100', icon: ArrowDownRight };
      case 'exit':
        return { label: 'Uscita', color: 'bg-amber-100 text-amber-700 hover:bg-amber-100', icon: ArrowUpRight };
      case 'sale':
        return { label: 'Vendita', color: 'bg-blue-100 text-blue-700 hover:bg-blue-100', icon: ShoppingBag };
      default:
        return { label: movement.type, color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300', icon: FileText };
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-card p-4 shadow-sm sticky top-0 z-10 space-y-4 rounded-lg mb-6 border dark:border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Movimentazione Merce</h1>
          {(userRole === 'admin' || userRole === 'operativo') && (
            <Link href="/movements/new" className="w-full sm:w-auto">
              <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Nuova Bolla
              </Button>
            </Link>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Cerca Movimento (Bolla, Commessa, Causale, Articolo, Note... usa virgola per OR)"
              className="pl-9 bg-slate-100 dark:bg-muted border-none"
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <PageSizeSelector value={pageSize} onChange={(s) => { setPageSize(s); setPage(1); }} />
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">Dal</span>
              <Input
                type="date"
                className="bg-slate-100 dark:bg-muted border-none w-36"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                title="Data dal"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">Al</span>
              <Input
                type="date"
                className="bg-slate-100 dark:bg-muted border-none w-36"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                title="Data al"
              />
            </div>
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                title="Rimuovi filtro data"
                className="shrink-0"
              >
                ×
              </Button>
            )}
          </div>
        </div>
      </div>

      {loading && movements.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento movimenti...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col justify-center items-center py-12 text-center">
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-full mb-4">
            <FileText className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Errore di Caricamento</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">{error}</p>
          <Button onClick={loadMovements} variant="outline">
            Riprova
          </Button>
        </div>
      ) : (
        <>
          {viewMode === 'list' && (
            <div className="space-y-1.5 mb-4">
              {movements.length === 0 ? (
                <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                  <Truck className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nessun movimento trovato</p>
                </div>
              ) : movements.map((movement) => {
                const typeConfig = getTypeConfig(movement);
                const Icon = typeConfig.icon;
                const jobLabel = movement.type === 'sale' && movement.clientName
                  ? `VENDITA: ${movement.clientName}`
                  : (movement.jobName || movement.jobDescription || movement.jobCode);
                return (
                  <Link href={`/movements/${movement.id}`} key={movement.id}>
                    <div className="flex items-start gap-3 px-4 py-2.5 bg-white dark:bg-card border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-sm hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer">
                      <Badge variant="secondary" className={`${typeConfig.color} text-[10px] px-1.5 py-0.5 shrink-0 flex items-center gap-1 mt-0.5`}>
                        <Icon className="h-3 w-3" />{typeConfig.label}
                      </Badge>
                      <span className="font-semibold text-slate-900 dark:text-white w-28 shrink-0 truncate text-sm">
                        {movement.number}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs w-24 shrink-0 pt-0.5">
                        {format(new Date(movement.date), 'dd/MM/yyyy', { locale: it })}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-xs w-36 shrink-0 break-words hidden sm:block">
                        {movement.causal || '—'}
                      </span>
                      <span className="text-blue-600 dark:text-blue-400 text-xs w-36 shrink-0 break-words hidden md:block">
                        {jobLabel || '—'}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs flex-1 break-words hidden lg:block">
                        {movement.itemNames?.join(', ') || '—'}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 ml-auto pt-0.5">
                        {movement.itemCount ?? movement.items?.length ?? 0} art.
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "hidden"}>
            {movements.length === 0 ? (
              <div className="col-span-full text-center py-10 text-slate-400 dark:text-slate-500">
                <Truck className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nessun movimento trovato</p>
              </div>
            ) : (
              movements.map((movement) => {
                const typeConfig = getTypeConfig(movement);
                const Icon = typeConfig.icon;

                const handleQuickPrint = async (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    // Load full delivery note data
                    const fullNote = await deliveryNotesApi.getById(movement.id);

                    // Group items by inventory ID
                    const grouped = new Map<string, DeliveryNoteItem>();
                    fullNote.items?.forEach(item => {
                      const key = item.inventoryId;
                      if (grouped.has(key)) {
                        const existing = grouped.get(key)!;
                        grouped.set(key, { ...existing, quantity: existing.quantity + item.quantity });
                      } else {
                        grouped.set(key, { ...item });
                      }
                    });
                    const groupedItems = Array.from(grouped.values());

                    // Generate and download PDF
                    const { generateDeliveryNotePDF } = await import('@/lib/pdf/delivery-note-pdf');
                    await generateDeliveryNotePDF(fullNote, groupedItems);
                  } catch (error) {
                    console.error("Failed to print", error);
                    notify.error("Errore durante la stampa");
                  }
                };

                return (
                  <Link href={`/movements/${movement.id}`} key={movement.id}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-slate-200 dark:border-slate-700">
                      <CardContent className="p-3 sm:p-5">
                        <div className="flex justify-between items-start mb-3 sm:mb-4">
                          <div className="min-w-0 flex-1 mr-2">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm sm:text-base">
                              <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                              <span className="truncate">Bolla: {movement.number}</span>
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3 shrink-0" />
                              {format(new Date(movement.date), 'dd MMMM yyyy', { locale: it })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                            <button
                              onClick={handleQuickPrint}
                              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-blue-600 transition-colors"
                              title="Stampa rapida"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            <Badge variant="secondary" className={`${typeConfig.color} text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2.5 sm:py-0.5`}>
                              <Icon className="mr-1 h-3 w-3" />
                              {typeConfig.label}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs sm:text-sm">
                          <div className="flex justify-between gap-3 py-1 border-b border-slate-50 dark:border-slate-700">
                            <span className="text-slate-500 dark:text-slate-400 shrink-0">Causale</span>
                            <span className="font-medium text-right break-words">{movement.causal}</span>
                          </div>
                           {movement.type === 'sale' && movement.clientName && (
                            <div className="flex justify-between gap-3 py-1 border-b border-slate-50 dark:border-slate-700">
                              <span className="text-slate-500 dark:text-slate-400 shrink-0">Committente</span>
                              <span className="font-medium text-blue-600 dark:text-blue-400 text-right break-words">
                                {movement.clientName}
                              </span>
                            </div>
                          )}
                          {movement.type !== 'sale' && (movement.jobCode || movement.jobName || movement.jobDescription) && (
                            <div className="flex justify-between gap-3 py-1 border-b border-slate-50 dark:border-slate-700">
                              <span className="text-slate-500 dark:text-slate-400 shrink-0">Commessa</span>
                              {(() => {
                                const displayName = movement.jobName || movement.jobDescription;
                                const clientName = movement.jobClientName;
                                const label = displayName
                                  ? `${displayName}${clientName ? ` - ${clientName}` : ''}`
                                  : movement.jobCode;
                                return (
                                  <span className="font-medium text-blue-600 dark:text-blue-400 text-right break-words">
                                    {label}
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                          <div className="py-1">
                            <div className="flex justify-between mb-1">
                              <span className="text-slate-500 dark:text-slate-400">Articoli</span>
                              <span className="font-medium text-xs text-slate-500">
                                {movement.itemCount ?? movement.items?.length ?? 0} righe
                              </span>
                            </div>
                            {movement.itemNames && movement.itemNames.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {movement.itemNames.map((name, i) => (
                                  <span key={i} className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })
            )}
          </div>

          <PaginationControls
            page={page}
            totalPages={totalPages}
            loading={loading}
            onPageChange={setPage}
            itemLabel="movimenti"
          />
        </>
      )}
    </>
  );
}
