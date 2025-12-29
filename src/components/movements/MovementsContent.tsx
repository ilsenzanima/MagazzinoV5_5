"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Loader2, FileText, ArrowDownRight, ArrowUpRight, ShoppingBag, Truck, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useDeferredValue } from "react";
import { deliveryNotesApi, DeliveryNote } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/components/auth-provider";

interface MovementsContentProps {
  initialMovements: DeliveryNote[];
  initialTotalItems: number;
}

export default function MovementsContent({ initialMovements, initialTotalItems }: MovementsContentProps) {
  const { userRole } = useAuth();
  const ITEMS_PER_PAGE = 12;
  const initialTotalPages = Math.ceil(initialTotalItems / ITEMS_PER_PAGE);

  const [movements, setMovements] = useState<DeliveryNote[]>(initialMovements);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Search state
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);

  // Track if it's the first render to avoid fetching what we already have
  const [isFirstRender, setIsFirstRender] = useState(true);

  useEffect(() => {
    // Skip the first load if we are on page 1 and search is empty (we have initial data)
    if (isFirstRender && page === 1 && deferredSearch === "") {
      setIsFirstRender(false);
      return;
    }

    loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, deferredSearch]);

  const loadMovements = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, total } = await deliveryNotesApi.getPaginated({
        page,
        limit: ITEMS_PER_PAGE,
        search: deferredSearch
      });

      setMovements(data);
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

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'entry':
        return { label: 'Entrata', color: 'bg-green-100 text-green-700 hover:bg-green-100', icon: ArrowDownRight };
      case 'exit':
        return { label: 'Uscita', color: 'bg-amber-100 text-amber-700 hover:bg-amber-100', icon: ArrowUpRight };
      case 'sale':
        return { label: 'Vendita', color: 'bg-blue-100 text-blue-700 hover:bg-blue-100', icon: ShoppingBag };
      default:
        return { label: type, color: 'bg-slate-100 text-slate-700', icon: FileText };
    }
  };

  return (
    <>
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 space-y-4 rounded-lg mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Movimentazione Merce</h1>
          {(userRole === 'admin' || userRole === 'operativo') && (
            <Link href="/movements/new">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" />
                Nuova Bolla
              </Button>
            </Link>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cerca Movimento (Bolla, Commessa, Causale...)"
            className="pl-9 bg-slate-100 border-none"
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {loading && movements.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500">Caricamento movimenti...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col justify-center items-center py-12 text-center">
          <div className="bg-red-50 text-red-600 p-4 rounded-full mb-4">
            <FileText className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Errore di Caricamento</h3>
          <p className="text-slate-500 mb-6 max-w-md">{error}</p>
          <Button onClick={loadMovements} variant="outline">
            Riprova
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {movements.length === 0 ? (
              <div className="col-span-full text-center py-10 text-slate-400">
                <Truck className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nessun movimento trovato</p>
              </div>
            ) : (
              movements.map((movement) => {
                const typeConfig = getTypeConfig(movement.type);
                const Icon = typeConfig.icon;

                return (
                  <Link href={`/movements/${movement.id}`} key={movement.id}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-slate-200">
                      <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                              <FileText className="h-4 w-4 text-blue-600" />
                              Bolla: {movement.number}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(movement.date), 'dd MMMM yyyy', { locale: it })}
                            </p>
                          </div>
                          <Badge variant="secondary" className={typeConfig.color}>
                            <Icon className="mr-1 h-3 w-3" />
                            {typeConfig.label}
                          </Badge>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-500">Causale</span>
                            <span className="font-medium truncate max-w-[150px]">{movement.causal}</span>
                          </div>
                          {movement.jobCode && (
                            <div className="flex justify-between py-1 border-b border-slate-50">
                              <span className="text-slate-500">Commessa</span>
                              <span className="font-medium text-blue-600">{movement.jobCode}</span>
                            </div>
                          )}
                          <div className="flex justify-between py-1">
                            <span className="text-slate-500">Articoli</span>
                            <span className="font-medium">
                              {/* Fallback per compatibilità con i dati che arrivano dal backend */}
                              {movement.itemCount ?? movement.items?.length ?? 0} righe
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8 pb-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-slate-600">
                Pagina {page} di {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
