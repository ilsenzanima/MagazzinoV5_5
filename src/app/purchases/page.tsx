"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Search, Loader2, FileText, Calendar, User, AlertTriangle,
  Paperclip, Package, PackageX, Receipt, ShoppingCart, ClipboardList, ArrowRightLeft
} from "lucide-react";
import { PaginationControls } from "@/components/ui/pagination-controls";
import Link from "next/link";
import { useState, useEffect, Suspense, useDeferredValue } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { purchasesApi, invoicesApi, Purchase, Invoice } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { ConvertOrdersModal } from "@/components/purchases/ConvertOrdersModal";
import { AdvancedSearchTab } from "@/components/purchases/AdvancedSearchTab";

// ── Shared filter bar ─────────────────────────────────────────────────────────

function FilterBar({
  searchTerm, setSearchTerm,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  placeholder,
}: {
  searchTerm: string; setSearchTerm: (v: string) => void;
  dateFrom: string; setDateFrom: (v: string) => void;
  dateTo: string; setDateTo: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
        <Input
          placeholder={placeholder}
          className="pl-9 bg-slate-100 dark:bg-muted border-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">Dal</span>
          <Input type="date" className="bg-slate-100 dark:bg-muted border-none w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">Al</span>
          <Input type="date" className="bg-slate-100 dark:bg-muted border-none w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="icon" onClick={() => { setDateFrom(""); setDateTo(""); }} className="shrink-0">×</Button>
        )}
      </div>
    </div>
  );
}

// ── Acquisti / Ordini tab (shared) ────────────────────────────────────────────

function PurchasesTab({ orderType }: { orderType: 'purchase' | 'order' }) {
  const { userRole } = useAuth();
  const searchParams = useSearchParams();
  const initialSupplierId = searchParams?.get("supplierId");

  const [items, setItems] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const debouncedSearch = useDeferredValue(searchTerm);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const LIMIT = 12;
  const [convertOrder, setConvertOrder] = useState<Purchase | null>(null);

  const isOrder = orderType === 'order';
  const newHref = isOrder ? "/purchases/new?type=order" : "/purchases/new";
  const newLabel = isOrder ? "Nuovo Ordine" : "Nuovo Acquisto";

  useEffect(() => { setPage(1); }, [debouncedSearch, dateFrom, dateTo, initialSupplierId]);
  useEffect(() => { load(); }, [page, debouncedSearch, dateFrom, dateTo, initialSupplierId, orderType]);

  const load = async () => {
    try {
      setLoading(true);
      const { data, total } = await purchasesApi.getPaginated({
        page, limit: LIMIT, search: debouncedSearch,
        supplierId: initialSupplierId || '',
        dateFrom, dateTo, orderType,
      });
      setItems(data);
      setTotalItems(total);
    } catch (error) {
      console.error("Failed to load", error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalItems / LIMIT);

  return (
    <>
      {initialSupplierId && (
        <div className="flex justify-end mb-4">
          <Link href="/purchases"><Button variant="outline" size="sm">Mostra Tutti</Button></Link>
        </div>
      )}

      <FilterBar
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
        placeholder={isOrder ? "Cerca Ordine (Numero, Fornitore...)" : "Cerca Acquisto (Bolla, Fornitore...)"}
      />

      <div className="mt-4">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-slate-500 dark:text-slate-400">
              {isOrder ? "Caricamento ordini..." : "Caricamento acquisti..."}
            </span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.length === 0 ? (
                <div className="col-span-full text-center py-10 text-slate-400 dark:text-slate-500">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>{isOrder ? "Nessun ordine trovato" : "Nessun acquisto trovato"}</p>
                </div>
              ) : (
                items.map((purchase) => {
                  const hasMissingPrices = purchase.items?.some(item => item.price === 0) || purchase.totalAmount === 0;
                  const articleNames = purchase.items
                    ?.filter(i => i.itemName)
                    .map(i => i.itemModel ? `${i.itemName} (${i.itemModel})` : i.itemName!)
                    .filter((v, idx, arr) => arr.indexOf(v) === idx)
                    .join(', ');

                  return (
                    <Link href={`/purchases/${purchase.id}`} key={purchase.id}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-slate-200 dark:border-slate-700">
                        <CardContent className="p-5">
                          <div className="flex justify-between items-start mb-3">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                                <span className="truncate">
                                  {isOrder ? "Ordine: " : "Bolla: "}{purchase.deliveryNoteNumber}
                                </span>
                              </h3>
                              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 truncate">
                                <User className="h-3 w-3 shrink-0" />
                                {purchase.supplierName || 'Fornitore Sconosciuto'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              {isOrder && purchase.convertedPurchaseId && (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                  Evaso
                                </span>
                              )}
                              {purchase.invoiceId && (
                                <span title="Fattura collegata"><Receipt className="h-4 w-4 text-blue-500" /></span>
                              )}
                              {purchase.isExhausted ? (
                                <span title="Materiale esaurito"><PackageX className="h-4 w-4 text-slate-400" /></span>
                              ) : (
                                <span title="Materiale disponibile"><Package className="h-4 w-4 text-emerald-500" /></span>
                              )}
                              {purchase.documentUrl && (
                                <span title="Documento allegato"><Paperclip className="h-4 w-4 text-violet-500" /></span>
                              )}
                              {hasMissingPrices && (userRole === 'admin' || userRole === 'operativo') && (
                                <span title="Prezzo mancante"><AlertTriangle className="h-5 w-5 text-amber-500" /></span>
                              )}
                            </div>
                          </div>

                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div>
                              {(userRole === 'admin' || userRole === 'operativo') ? (
                                <div className="font-bold text-lg text-slate-900 dark:text-white">
                                  {purchase.totalAmount !== undefined && purchase.totalAmount !== null
                                    ? `€ ${purchase.totalAmount.toFixed(2)}` : '-'}
                                </div>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500 italic text-sm">Riservato</span>
                              )}
                            </div>
                            {isOrder && !purchase.convertedPurchaseId && (userRole === 'admin' || userRole === 'operativo') && (
                              <button
                                onClick={e => { e.preventDefault(); setConvertOrder(purchase); }}
                                title="Converti in Acquisto"
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 border border-blue-200 dark:border-blue-800 rounded px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors shrink-0"
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                                Converti
                              </button>
                            )}
                          </div>

                          <div className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                            <span>{new Date(purchase.deliveryNoteDate).toLocaleDateString('it-IT')}</span>
                          </div>

                          {articleNames && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed line-clamp-2">
                              {articleNames}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })
              )}
            </div>
            <PaginationControls
              page={page} totalPages={totalPages} loading={loading}
              onPageChange={setPage}
              itemLabel={isOrder ? "ordini" : "acquisti"}
            />
          </>
        )}
      </div>

      {convertOrder && (
        <ConvertOrdersModal
          open={!!convertOrder}
          onOpenChange={open => { if (!open) setConvertOrder(null); }}
          triggerOrder={convertOrder}
        />
      )}
    </>
  );
}

// ── Fatture tab ───────────────────────────────────────────────────────────────

function InvoicesTab() {
  const { userRole } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const debouncedSearch = useDeferredValue(searchTerm);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const LIMIT = 12;

  useEffect(() => { setPage(1); }, [debouncedSearch, dateFrom, dateTo]);
  useEffect(() => { loadInvoices(); }, [page, debouncedSearch, dateFrom, dateTo]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const { data, total } = await invoicesApi.getPaginated({
        page, limit: LIMIT, search: debouncedSearch, dateFrom, dateTo,
      });
      setInvoices(data);
      setTotalItems(total);
    } catch (error) {
      console.error("Failed to load invoices", error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalItems / LIMIT);

  return (
    <>
      <FilterBar
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
        placeholder="Cerca per numero fattura..."
      />

      <div className="mt-4">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento fatture...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {invoices.length === 0 ? (
                <div className="col-span-full text-center py-10 text-slate-400 dark:text-slate-500">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nessuna fattura trovata</p>
                </div>
              ) : (
                invoices.map((invoice) => (
                  <Link href={`/invoices/${invoice.id}`} key={invoice.id}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-slate-200 dark:border-slate-700">
                      <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                              <span className="truncate">Fattura: {invoice.invoiceNumber}</span>
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 truncate">
                              <User className="h-3 w-3 shrink-0" />
                              {invoice.supplierName || 'Fornitore Sconosciuto'}
                            </p>
                          </div>
                          {invoice.documentUrls && invoice.documentUrls.length > 0 && (
                            <span title="Documento allegato"><Paperclip className="h-4 w-4 text-violet-500 shrink-0 ml-2" /></span>
                          )}
                        </div>
                        <div className="mb-2">
                          {(userRole === 'admin' || userRole === 'operativo') ? (
                            <div className="font-bold text-lg text-slate-900 dark:text-white">
                              {invoice.totalAmount != null ? `€ ${Number(invoice.totalAmount).toFixed(2)}` : '—'}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-sm">Riservato</span>
                          )}
                        </div>
                        {invoice.purchases && invoice.purchases.length > 0 && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                            {invoice.purchases.length} boll{invoice.purchases.length === 1 ? 'a' : 'e'} collegate
                          </p>
                        )}
                        <div className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span>{new Date(invoice.invoiceDate).toLocaleDateString('it-IT')}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </div>
            <PaginationControls
              page={page} totalPages={totalPages} loading={loading}
              onPageChange={setPage} itemLabel="fatture"
            />
          </>
        )}
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function PurchasesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userRole } = useAuth();
  const canSeeFatture = userRole === 'admin' || userRole === 'operativo';

  const rawTab = (searchParams?.get("tab") ?? "acquisti") as "acquisti" | "ordini" | "fatture" | "ricerca";
  // Redirect user role away from fatture tab
  const tab = rawTab === "fatture" && !canSeeFatture ? "acquisti" : rawTab;

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", value);
    params.delete("supplierId");
    router.replace(`/purchases?${params.toString()}`);
  };

  return (
    <>
      <div className="bg-white dark:bg-card p-4 shadow-sm sticky top-0 z-10 rounded-lg mb-6 border dark:border-border">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {tab === "acquisti" ? "Gestione Acquisti" : tab === "ordini" ? "Gestione Ordini" : tab === "fatture" ? "Gestione Fatture" : "Ricerca Avanzata"}
          </h1>
          {canSeeFatture && tab !== "ricerca" && (
            <Link href={tab === "fatture" ? "/invoices/new" : tab === "ordini" ? "/purchases/new?type=order" : "/purchases/new"}>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Plus className="mr-1.5 h-4 w-4" />
                {tab === "fatture" ? "Nuova Fattura" : tab === "ordini" ? "Nuovo Ordine" : "Nuovo Acquisto"}
              </Button>
            </Link>
          )}
        </div>
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="acquisti" className="flex items-center gap-1.5 flex-1 sm:flex-none">
              <ShoppingCart className="h-4 w-4" />
              Acquisti
            </TabsTrigger>
            <TabsTrigger value="ordini" className="flex items-center gap-1.5 flex-1 sm:flex-none">
              <ClipboardList className="h-4 w-4" />
              Ordini
            </TabsTrigger>
            {canSeeFatture && (
              <TabsTrigger value="fatture" className="flex items-center gap-1.5 flex-1 sm:flex-none">
                <Receipt className="h-4 w-4" />
                Fatture
              </TabsTrigger>
            )}
            <TabsTrigger value="ricerca" className="flex items-center gap-1.5 flex-1 sm:flex-none">
              <Search className="h-4 w-4" />
              Ricerca Avanzata
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "acquisti" && <PurchasesTab orderType="purchase" />}
      {tab === "ordini" && <PurchasesTab orderType="order" />}
      {canSeeFatture && tab === "fatture" && <InvoicesTab />}
      {tab === "ricerca" && <AdvancedSearchTab />}
    </>
  );
}

export default function PurchasesPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento...</span>
        </div>
      }>
        <PurchasesPageContent />
      </Suspense>
    </DashboardLayout>
  );
}
