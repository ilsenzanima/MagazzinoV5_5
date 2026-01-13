"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Loader2, FileText, Calendar, User, AlertTriangle, ChevronLeft, ChevronRight, CheckCircle, Package } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, Suspense, useDeferredValue, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { purchasesApi, Purchase } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-provider";

// Computed status types
type PurchaseStatus = 'ok' | 'missing_prices' | 'exhausted';

// Helper function to compute purchase status
function getPurchaseStatus(purchase: Purchase): PurchaseStatus {
  const items = purchase.items || [];

  // Check if any item has remainingPieces <= 0
  const hasExhaustedItems = items.some(item =>
    item.remainingPieces !== undefined && item.remainingPieces !== null && item.remainingPieces <= 0
  );
  if (hasExhaustedItems) return 'exhausted';

  // Check if any item has price = 0
  const hasMissingPrices = items.some(item => item.price === 0);
  if (hasMissingPrices) return 'missing_prices';

  return 'ok';
}

// Helper to get status display info
function getStatusInfo(status: PurchaseStatus) {
  switch (status) {
    case 'ok':
      return { label: 'OK', variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' };
    case 'missing_prices':
      return { label: 'Prezzi mancanti', variant: 'secondary' as const, icon: AlertTriangle, color: 'text-amber-600' };
    case 'exhausted':
      return { label: 'Pezzi esauriti', variant: 'destructive' as const, icon: Package, color: 'text-red-600' };
  }
}

function PurchasesContent() {
  const { userRole } = useAuth();
  const searchParams = useSearchParams();
  const initialSupplierId = searchParams?.get("supplierId");

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDeferredValue(searchTerm);
  const [activeTab, setActiveTab] = useState<'all' | 'ok' | 'missing_prices' | 'exhausted'>('all');

  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const LIMIT = 12;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, initialSupplierId, activeTab]);

  useEffect(() => {
    loadPurchases();
  }, [page, debouncedSearch, initialSupplierId]);

  const loadPurchases = async () => {
    try {
      setLoading(true);
      const { data, total } = await purchasesApi.getPaginated({
        page,
        limit: LIMIT,
        search: debouncedSearch,
        supplierId: initialSupplierId || ''
      });
      setPurchases(data);
      setTotalItems(total);
    } catch (error) {
      console.error("Failed to load purchases", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter purchases by computed status
  const filteredPurchases = useMemo(() => {
    if (activeTab === 'all') return purchases;
    return purchases.filter(p => getPurchaseStatus(p) === activeTab);
  }, [purchases, activeTab]);

  // Count by status for tab badges
  const statusCounts = useMemo(() => {
    const counts = { ok: 0, missing_prices: 0, exhausted: 0 };
    purchases.forEach(p => {
      const status = getPurchaseStatus(p);
      counts[status]++;
    });
    return counts;
  }, [purchases]);

  const totalPages = Math.ceil(totalItems / LIMIT);

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

        {/* Filter Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" className="text-xs sm:text-sm">
              Tutti ({purchases.length})
            </TabsTrigger>
            <TabsTrigger value="ok" className="text-xs sm:text-sm">
              <CheckCircle className="h-3 w-3 mr-1 hidden sm:inline" />
              OK ({statusCounts.ok})
            </TabsTrigger>
            <TabsTrigger value="missing_prices" className="text-xs sm:text-sm">
              <AlertTriangle className="h-3 w-3 mr-1 hidden sm:inline" />
              Prezzi ({statusCounts.missing_prices})
            </TabsTrigger>
            <TabsTrigger value="exhausted" className="text-xs sm:text-sm">
              <Package className="h-3 w-3 mr-1 hidden sm:inline" />
              Esauriti ({statusCounts.exhausted})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <Input
            placeholder="Cerca Acquisto (Bolla, Fornitore...)"
            className="pl-9 bg-slate-100 dark:bg-muted border-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
            {filteredPurchases.length === 0 ? (
              <div className="col-span-full text-center py-10 text-slate-400 dark:text-slate-500">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nessun acquisto trovato</p>
              </div>
            ) : (
              filteredPurchases.map((purchase) => {
                const status = getPurchaseStatus(purchase);
                const statusInfo = getStatusInfo(status);
                const StatusIcon = statusInfo.icon;

                return (
                  <Link href={`/purchases/${purchase.id}`} key={purchase.id}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-slate-200 dark:border-slate-700">
                      <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <FileText className="h-4 w-4 text-blue-600" />
                              Bolla: {purchase.deliveryNoteNumber}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {purchase.supplierName || 'Fornitore Sconosciuto'}
                            </p>
                          </div>
                          <Badge variant={statusInfo.variant} className="flex items-center gap-1">
                            <StatusIcon className={`h-3 w-3 ${statusInfo.color}`} />
                            {statusInfo.label}
                          </Badge>
                        </div>

                        <div className="mb-2">
                          {(userRole === 'admin' || userRole === 'operativo') ? (
                            <div className="font-bold text-lg text-slate-900 dark:text-white">
                              {purchase.totalAmount !== undefined && purchase.totalAmount !== null
                                ? `€ ${purchase.totalAmount.toFixed(2)}`
                                : '-'
                              }
                              {purchase.totalAmount === 0 && (
                                <div className="inline-block ml-2" title="Prezzo mancante">
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic text-sm">Riservato</span>
                          )}
                        </div>

                        {status === 'missing_prices' && (userRole === 'admin' || userRole === 'operativo') && (
                          <div className="mb-4 flex items-center text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded text-xs font-medium border border-yellow-100 dark:border-yellow-900">
                            <AlertTriangle className="h-3 w-3 mr-1.5" />
                            Prezzi mancanti
                          </div>
                        )}

                        {status === 'exhausted' && (
                          <div className="mb-4 flex items-center text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-2 rounded text-xs font-medium border border-red-100 dark:border-red-900">
                            <Package className="h-3 w-3 mr-1.5" />
                            Pezzi esauriti
                          </div>
                        )}

                        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                            <span>Data: {new Date(purchase.deliveryNoteDate).toLocaleDateString('it-IT')}</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs text-slate-400 dark:text-slate-500">
                          <span>Registrato da: {purchase.createdByName || 'N/D'}</span>
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
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="sm"
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
