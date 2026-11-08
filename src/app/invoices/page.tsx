"use client";

import { notify } from "@/lib/notify";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListPageHeader } from "@/components/ui/list-page-header";
import { FloatingAddButton } from "@/components/ui/floating-add-button";
import { Loader2, FileText, Calendar, User, Paperclip } from "lucide-react";
import { PaginationControls } from "@/components/ui/pagination-controls";
import Link from "next/link";
import { useState, useEffect, useRef, Suspense, useDeferredValue } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { invoicesApi, Invoice } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { formatCurrency } from "@/lib/utils/format";

function InvoicesContent() {
  const { userRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
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
  }, [debouncedSearch]);

  useEffect(() => { loadInvoices(); }, [page, debouncedSearch]);

  // Keep the URL in sync with search/date filters/page so browser back/forward
  // restores the exact view instead of resetting it.
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (page !== 1) params.set("page", String(page));
    const query = params.toString();
    router.replace(query ? `/invoices?${query}` : "/invoices", { scroll: false });
  }, [debouncedSearch, page, router]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const { data, total } = await invoicesApi.getPaginated({
        page,
        limit: LIMIT,
        search: debouncedSearch,
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
      <ListPageHeader
        strip
        title="Gestione Fatturazione"
        search={{ id: "invoices-search", label: "Cerca fattura", value: searchTerm, onChange: setSearchTerm, placeholder: "Cerca per numero fattura..." }}
      />

      {(userRole === 'admin' || userRole === 'operativo') && (
        <FloatingAddButton showOnMobile label="Nuova Fattura" href="/invoices/new" />
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento fatture...</span>
        </div>
      ) : (
        <>
          {invoices.length > 0 && (
            <div className="hidden overflow-hidden rounded-xl border bg-card shadow-sm md:block">
              <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                <TableHeader>
                  <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                    <TableHead className="w-40 text-xs font-semibold uppercase tracking-wide text-slate-600">Fattura</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Fornitore</TableHead>
                    <TableHead className="w-28 text-xs font-semibold uppercase tracking-wide text-slate-600">Data</TableHead>
                    <TableHead className="w-32 text-xs font-semibold uppercase tracking-wide text-slate-600">Bolle collegate</TableHead>
                    <TableHead className="w-32 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Importo</TableHead>
                    <TableHead className="w-16 text-xs font-semibold uppercase tracking-wide text-slate-600">Allegato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="cursor-pointer" onClick={() => router.push(`/invoices/${invoice.id}`)}>
                      <TableCell className="truncate py-1.5 font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell className="truncate py-1.5">{invoice.supplierName || 'Fornitore sconosciuto'}</TableCell>
                      <TableCell className="whitespace-nowrap py-1.5">{new Date(invoice.invoiceDate).toLocaleDateString('it-IT')}</TableCell>
                      <TableCell className="py-1.5">{invoice.purchases && invoice.purchases.length > 0 ? invoice.purchases.length : '—'}</TableCell>
                      <TableCell className="py-1.5 text-right">
                        {(userRole === 'admin' || userRole === 'operativo')
                          ? (invoice.totalAmount !== undefined && invoice.totalAmount !== null ? formatCurrency(Number(invoice.totalAmount)) : '—')
                          : <span className="text-xs italic text-slate-400">Riservato</span>}
                      </TableCell>
                      <TableCell className="py-1.5">
                        {invoice.documentUrls && invoice.documentUrls.length > 0 ? <Paperclip className="h-4 w-4 text-violet-500" aria-label="Documento allegato" /> : <span className="text-slate-300">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className={`grid grid-cols-1 gap-4 ${invoices.length > 0 ? "md:hidden" : ""}`}>
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
                              ? formatCurrency(Number(invoice.totalAmount))
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
