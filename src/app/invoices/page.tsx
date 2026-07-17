"use client";

import { notify } from "@/lib/notify";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Loader2, FileText, Calendar, User, Paperclip } from "lucide-react";
import { PaginationControls } from "@/components/ui/pagination-controls";
import Link from "next/link";
import { useState, useEffect, useRef, Suspense, useDeferredValue } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { invoicesApi, Invoice } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

function InvoicesContent() {
  const { userRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const debouncedSearch = useDeferredValue(searchTerm);

  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [totalItems, setTotalItems] = useState(0);
  const LIMIT = 12;

  // Skip the reset-to-page-1 on the very first render so a page restored
  // from the URL (e.g. via browser back) isn't immediately wiped out.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setPage(1);
  }, [debouncedSearch, dateFrom, dateTo]);

  useEffect(() => { loadInvoices(); }, [page, debouncedSearch, dateFrom, dateTo]);

  // Keep the URL in sync with search/date filters/page so browser back/forward
  // restores the exact view instead of resetting it.
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (page !== 1) params.set("page", String(page));
    const query = params.toString();
    router.replace(query ? `/invoices?${query}` : "/invoices", { scroll: false });
  }, [debouncedSearch, dateFrom, dateTo, page, router]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const { data, total } = await invoicesApi.getPaginated({
        page,
        limit: LIMIT,
        search: debouncedSearch,
        dateFrom,
        dateTo,
      });
      setInvoices(data);
      setTotalItems(total);
    } catch (error) {
      console.error("Failed to load invoices", error);
      notify.error("Errore nel caricamento delle fatture. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalItems / LIMIT);

  return (
    <>
      <div className="bg-white dark:bg-card p-4 shadow-sm sticky top-0 z-10 space-y-4 rounded-lg mb-6 border dark:border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Gestione Fatturazione</h1>
          <div className="flex gap-2 w-full sm:w-auto">
            {(userRole === 'admin' || userRole === 'operativo') && (
              <Link href="/invoices/new" className="flex-1 sm:flex-none">
                <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuova Fattura
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Cerca per numero fattura..."
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
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">Al</span>
              <Input
                type="date"
                className="bg-slate-100 dark:bg-muted border-none w-36"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
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
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {invoice.documentUrls && invoice.documentUrls.length > 0 && (
                            <span title="Documento allegato">
                              <Paperclip className="h-4 w-4 text-violet-500" />
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mb-3">
                        {(userRole === 'admin' || userRole === 'operativo') ? (
                          <div className="font-bold text-lg text-slate-900 dark:text-white">
                            {invoice.totalAmount !== undefined && invoice.totalAmount !== null
                              ? `€ ${Number(invoice.totalAmount).toFixed(2)}`
                              : '—'
                            }
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic text-sm">Riservato</span>
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
            page={page}
            totalPages={totalPages}
            loading={loading}
            onPageChange={setPage}
            itemLabel="fatture"
          />
        </>
      )}
    </>
  );
}

export default function InvoicesPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento...</span>
        </div>
      }>
        <InvoicesContent />
      </Suspense>
    </DashboardLayout>
  );
}
