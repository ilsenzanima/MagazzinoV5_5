"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Loader2, FileText, Calendar, User, AlertTriangle, Paperclip, Package, PackageX } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useRef, Suspense, useDeferredValue } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { purchasesApi, Purchase } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-provider";

function PurchasesContent() {
  const { userRole } = useAuth();
  const searchParams = useSearchParams();
  const initialSupplierId = searchParams?.get("supplierId");

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const debouncedSearch = useDeferredValue(searchTerm);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isFirstRender = useRef(true);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const LIMIT = 12;

  // Reset list when filters change
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setPurchases([]);
    setPage(1);
    setHasMore(true);
    hasMoreRef.current = true;
  }, [debouncedSearch, dateFrom, dateTo, initialSupplierId]);

  useEffect(() => {
    loadPurchases();
  }, [page, debouncedSearch, dateFrom, dateTo, initialSupplierId]);

  const loadPurchases = async () => {
    try {
      loadingRef.current = true;
      setLoading(true);
      const { data, total } = await purchasesApi.getPaginated({
        page,
        limit: LIMIT,
        search: debouncedSearch,
        supplierId: initialSupplierId || '',
        dateFrom,
        dateTo,
      });
      const more = page < Math.ceil(total / LIMIT);
      setPurchases(prev => page === 1 ? data : [...prev, ...data]);
      setHasMore(more);
      hasMoreRef.current = more;
    } catch (error) {
      console.error("Failed to load purchases", error);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      if (sentinelRef.current && observerRef.current) {
        observerRef.current.unobserve(sentinelRef.current);
        observerRef.current.observe(sentinelRef.current);
      }
    }
  };

  // IntersectionObserver creato una sola volta — legge loading/hasMore tramite ref
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const root = document.getElementById("main-scroll");
    observerRef.current = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !loadingRef.current && hasMoreRef.current) setPage(p => p + 1); },
      { root, rootMargin: "200px" }
    );
    observerRef.current.observe(el);
    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <>
      <div className="bg-white dark:bg-card p-4 shadow-sm sticky top-0 z-10 space-y-4 rounded-lg mb-6 border dark:border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {initialSupplierId ? "Acquisti Fornitore" : "Gestione Acquisti"}
          </h1>
          <div className="flex gap-2 w-full sm:w-auto">
            {initialSupplierId && (
              <Link href="/purchases">
                <Button variant="outline">Mostra Tutti</Button>
              </Link>
            )}
            {(userRole === 'admin' || userRole === 'operativo') && (
              <Link href="/purchases/new" className="flex-1 sm:flex-none">
                <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuovo Acquisto
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Cerca Acquisto (Bolla, Fornitore...)"
              className="pl-9 bg-slate-100 dark:bg-muted border-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
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

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento acquisti...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {purchases.length === 0 ? (
              <div className="col-span-full text-center py-10 text-slate-400 dark:text-slate-500">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nessun acquisto trovato</p>
              </div>
            ) : (
              purchases.map((purchase) => {
                // Check if any item has missing price
                const hasMissingPrices = purchase.items?.some(item => item.price === 0) || purchase.totalAmount === 0;

                return (
                  <Link href={`/purchases/${purchase.id}`} key={purchase.id}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-slate-200 dark:border-slate-700">
                      <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                              <span className="truncate">Bolla: {purchase.deliveryNoteNumber}</span>
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 truncate">
                              <User className="h-3 w-3 shrink-0" />
                              {purchase.supplierName || 'Fornitore Sconosciuto'}
                            </p>
                          </div>
                          {/* Status Icons */}
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {purchase.isExhausted ? (
                              <span title="Materiale esaurito">
                                <PackageX className="h-4 w-4 text-slate-400" />
                              </span>
                            ) : (
                              <span title="Materiale disponibile">
                                <Package className="h-4 w-4 text-emerald-500" />
                              </span>
                            )}
                            {purchase.documentUrl && (
                              <span title="Documento allegato">
                                <Paperclip className="h-4 w-4 text-violet-500" />
                              </span>
                            )}
                            {hasMissingPrices && (userRole === 'admin' || userRole === 'operativo') && (
                              <span title="Prezzo mancante">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mb-3">
                          {(userRole === 'admin' || userRole === 'operativo') ? (
                            <div className="font-bold text-lg text-slate-900 dark:text-white">
                              {purchase.totalAmount !== undefined && purchase.totalAmount !== null
                                ? `€ ${purchase.totalAmount.toFixed(2)}`
                                : '-'
                              }
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic text-sm">Riservato</span>
                          )}
                        </div>

                        <div className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span>{new Date(purchase.deliveryNoteDate).toLocaleDateString('it-IT')}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })
            )}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-4" />
          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          )}
          {!hasMore && purchases.length > 0 && (
            <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-6">Tutti gli acquisti caricati</p>
          )}
        </>
      )}
    </>
  );
}

export default function PurchasesPage() {
  const { userRole } = useAuth();
  const router = useRouter();

  return (
    <DashboardLayout>
      <Suspense fallback={
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento...</span>
        </div>
      }>
        <PurchasesContent />
      </Suspense>
    </DashboardLayout>
  );
}
