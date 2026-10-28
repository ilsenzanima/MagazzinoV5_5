"use client";

import { notify } from "@/lib/notify";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Loader2, FileText, Calendar, User, AlertTriangle,
  Paperclip, Package, PackageX, Receipt, ClipboardList, ArrowRightLeft, Undo2,
  ArrowUp, ArrowDown, ArrowUpDown
} from "lucide-react";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { KindBadge } from "@/components/purchases/KindBadge";
import { ListPageHeader } from "@/components/ui/list-page-header";
import { FloatingAddButton } from "@/components/ui/floating-add-button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Purchase } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { ConvertOrdersModal } from "@/components/purchases/ConvertOrdersModal";
import { formatCurrency } from "@/lib/utils/format";
import { suppliersApi } from "@/lib/services/suppliers";
import {
  purchaseDocumentsApi, PurchaseDocument, DocumentKind, PurchaseDocumentSortKey,
} from "@/lib/services/purchase-documents";

// Documenti per pagina: fisso, uguale per tutti
const PAGE_SIZE = 50;

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

const articleList = (p: Purchase) =>
  (p.items ?? [])
    .filter(i => i.itemName)
    .map(i => (i.itemModel ? `${i.itemName} (${i.itemModel})` : i.itemName!))
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .join(", ");

const linkedPurchasesLabel = (n: number) => `${n} boll${n === 1 ? "a collegata" : "e collegate"}`;

// La pagina Acquisti vecchia usava ?tab=acquisti|ordini|fatture: i link esistenti continuano a funzionare
function kindFromParams(params: URLSearchParams | null): DocumentKind | "all" {
  const raw = params?.get("tipo") ?? params?.get("tab");
  if (raw === "purchase" || raw === "acquisti") return "purchase";
  if (raw === "order" || raw === "ordini") return "order";
  if (raw === "invoice" || raw === "fatture") return "invoice";
  return "all";
}

function PurchasesPageContent() {
  const { userRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canSeeAmounts = userRole === "admin" || userRole === "operativo";
  const canSeeFatture = canSeeAmounts;

  const [kind, setKind] = useState<DocumentKind | "all">(kindFromParams(searchParams));
  const [searchTerm, setSearchTerm] = useState(searchParams?.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [dateFrom, setDateFrom] = useState(searchParams?.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams?.get("dateTo") || "");
  const [supplierId, setSupplierId] = useState(searchParams?.get("supplierId") || "");
  const [sortKey, setSortKey] = useState<PurchaseDocumentSortKey>((searchParams?.get("sort") as PurchaseDocumentSortKey) || "date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(searchParams?.get("dir") === "asc" ? "asc" : "desc");
  const [page, setPage] = useState(Number(searchParams?.get("page")) || 1);
  const [docs, setDocs] = useState<PurchaseDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [convertOrder, setConvertOrder] = useState<Purchase | null>(null);
  const requestId = useRef(0);

  // Chi non vede le fatture non può filtrarle
  const effectiveKind: DocumentKind | "all" = kind === "invoice" && !canSeeFatture ? "all" : kind;

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchTerm !== debouncedSearch) {
        setDebouncedSearch(searchTerm);
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm, debouncedSearch]);

  useEffect(() => {
    suppliersApi.getAll().then(list => setSuppliers(list.map(s => ({ id: s.id, name: s.name })))).catch(console.error);
  }, []);

  // L'indirizzo segue filtri, ordinamento e pagina: indietro/avanti del browser ritrovano la stessa vista
  useEffect(() => {
    const params = new URLSearchParams();
    if (kind !== "all") params.set("tipo", kind);
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (supplierId) params.set("supplierId", supplierId);
    if (sortKey !== "date") params.set("sort", sortKey);
    if (sortDir !== "desc") params.set("dir", sortDir);
    if (page !== 1) params.set("page", String(page));
    const query = params.toString();
    router.replace(query ? `/purchases?${query}` : "/purchases", { scroll: false });
  }, [kind, debouncedSearch, dateFrom, dateTo, supplierId, sortKey, sortDir, page, router]);

  const load = async () => {
    const id = ++requestId.current;
    try {
      setLoading(true);
      const { data, total } = await purchaseDocumentsApi.getPaginated({
        page, limit: PAGE_SIZE, search: debouncedSearch, kind: effectiveKind, supplierId,
        dateFrom, dateTo, sort: sortKey, dir: sortDir, includeInvoices: canSeeFatture,
      });
      if (id !== requestId.current) return;
      setDocs(data);
      setTotal(total);
    } catch (error) {
      console.error("Failed to load", error);
      if (id === requestId.current) notify.error("Errore nel caricamento dei dati. Riprova.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, effectiveKind, supplierId, dateFrom, dateTo, sortKey, sortDir, canSeeFatture]);

  const toggleSort = (key: PurchaseDocumentSortKey) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "date" || key === "amount" ? "desc" : "asc"); }
    setPage(1);
  };

  const changeKind = (v: string) => { setKind(v as DocumentKind | "all"); setPage(1); };
  const changeSupplier = (v: string) => { setSupplierId(v === "all" ? "" : v); setPage(1); };
  const changeDate = (setter: (v: string) => void) => (v: string) => { setter(v); setPage(1); };

  const anyFilterActive = kind !== "all" || !!supplierId || !!dateFrom || !!dateTo || !!searchTerm;
  const resetFilters = () => {
    setKind("all"); setSupplierId(""); setDateFrom(""); setDateTo(""); setSearchTerm(""); setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const href = (d: PurchaseDocument) => (d.kind === "invoice" ? `/invoices/${d.id}` : `/purchases/${d.id}`);

  // Icone di stato: le stesse di sempre
  const StateIcons = ({ doc }: { doc: PurchaseDocument }) => {
    if (doc.kind === "invoice") {
      const hasDocs = (doc.invoice.documentUrls?.length ?? 0) > 0;
      return hasDocs ? <span title="Documento allegato"><Paperclip className="h-4 w-4 text-violet-500" /></span> : null;
    }
    const p = doc.purchase;
    const isOrder = doc.kind === "order";
    const hasMissingPrices = p.items?.some(item => item.price === 0) || p.totalAmount === 0;
    return (
      <div className="flex items-center gap-1.5">
        {isOrder && p.convertedPurchaseId && (
          <span
            title="Ordine già convertito in un Acquisto: non è più eliminabile."
            className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
          >Evaso</span>
        )}
        {p.invoiceId && <span title="Fattura collegata"><Receipt className="h-4 w-4 text-blue-500" /></span>}
        {!isOrder && (p.isExhausted
          ? <span title="Materiale esaurito"><PackageX className="h-4 w-4 text-slate-400" /></span>
          : <span title="Materiale disponibile"><Package className="h-4 w-4 text-emerald-500" /></span>)}
        {(p.documentUrls?.length ?? 0) > 0 && <span title="Documento allegato"><Paperclip className="h-4 w-4 text-violet-500" /></span>}
        {!isOrder && p.hasReturn && <span title="Materiale reso al fornitore"><Undo2 className="h-4 w-4 text-amber-600" /></span>}
        {!isOrder && hasMissingPrices && canSeeAmounts && <span title="Prezzo mancante"><AlertTriangle className="h-4 w-4 text-amber-500" /></span>}
        {isOrder && !p.convertedPurchaseId && canSeeAmounts && (
          <button
            onClick={e => { e.stopPropagation(); e.preventDefault(); setConvertOrder(p); }}
            title="Converti in Acquisto"
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 border border-blue-200 dark:border-blue-800 rounded px-2 py-0.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <ArrowRightLeft className="h-3 w-3" />
            Converti
          </button>
        )}
      </div>
    );
  };

  const docNumber = (d: PurchaseDocument) => (d.kind === "invoice" ? d.invoice.invoiceNumber : d.purchase.deliveryNoteNumber);
  const docSupplier = (d: PurchaseDocument) => (d.kind === "invoice" ? d.invoice.supplierName : d.purchase.supplierName);
  const docDate = (d: PurchaseDocument) => (d.kind === "invoice" ? d.invoice.invoiceDate : d.purchase.deliveryNoteDate);
  const docAmount = (d: PurchaseDocument) => (d.kind === "invoice" ? d.invoice.totalAmount : d.purchase.totalAmount);
  const docDetail = (d: PurchaseDocument) =>
    d.kind === "invoice"
      ? ((d.invoice.purchases?.length ?? 0) > 0 ? linkedPurchasesLabel(d.invoice.purchases!.length) : "")
      : articleList(d.purchase);

  const headCls = "border-r text-xs font-semibold uppercase tracking-wide text-slate-600";
  const sortBtn = (key: PurchaseDocumentSortKey, label: string) => (
    <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
      {label}
      <SortArrow active={sortKey === key} dir={sortDir} />
    </button>
  );

  return (
    <>
      <ListPageHeader
        title="Gestione Acquisti"
        actions={canSeeAmounts && (
          <div className="flex gap-1.5 md:hidden">
            <Link href="/purchases/new"><Button size="sm" className="bg-blue-600 hover:bg-blue-700">Acquisto</Button></Link>
            <Link href="/purchases/new?type=order"><Button size="sm" variant="outline">Ordine</Button></Link>
            <Link href="/invoices/new"><Button size="sm" variant="outline">Fattura</Button></Link>
          </div>
        )}
        search={{ id: "purchases-search", label: "Cerca documenti", value: searchTerm, onChange: setSearchTerm, placeholder: "Cerca per numero, fornitore, commessa, articolo... (virgola = OR)" }}
        searchActions={
          <>
            <div className="hidden items-center gap-2 md:flex">
              <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">Dal</span>
              <Input type="date" aria-label="Dal" className="w-36 border-none bg-slate-100 dark:bg-muted" value={dateFrom} onChange={(e) => changeDate(setDateFrom)(e.target.value)} />
              <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">Al</span>
              <Input type="date" aria-label="Al" className="w-36 border-none bg-slate-100 dark:bg-muted" value={dateTo} onChange={(e) => changeDate(setDateTo)(e.target.value)} />
            </div>
            {anyFilterActive && (
              <Button variant="ghost" className="hidden shrink-0 text-xs text-slate-600 md:inline-flex" onClick={resetFilters}>
                Azzera filtri
              </Button>
            )}
          </>
        }
      >
        {/* Telefono: date, tipo e fornitore */}
        <div className="grid grid-cols-2 gap-2 md:hidden">
          <Input type="date" aria-label="Dal" className="border-none bg-slate-100 dark:bg-muted" value={dateFrom} onChange={(e) => changeDate(setDateFrom)(e.target.value)} />
          <Input type="date" aria-label="Al" className="border-none bg-slate-100 dark:bg-muted" value={dateTo} onChange={(e) => changeDate(setDateTo)(e.target.value)} />
          <Select value={kind} onValueChange={changeKind}>
            <SelectTrigger aria-label="Tipo"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i documenti</SelectItem>
              <SelectItem value="purchase">Acquisti</SelectItem>
              <SelectItem value="order">Ordini</SelectItem>
              {canSeeFatture && <SelectItem value="invoice">Fatture</SelectItem>}
            </SelectContent>
          </Select>
          <SearchableSelect
            options={[{ value: "all", label: "Tutti i fornitori" }, ...suppliers.map(s => ({ value: s.id, label: s.name }))]}
            value={supplierId}
            onValueChange={changeSupplier}
            placeholder="Fornitore"
            searchPlaceholder="Scrivi per cercare fornitore..."
          />
        </div>
      </ListPageHeader>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento...</span>
        </div>
      ) : (
        <>
          {/* Tabella: da tablet in su */}
          <div className="mb-4 hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
            <Table className="border-collapse">
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                  <TableHead className={`w-40 ${headCls}`}>
                    <div className="flex items-center gap-1">
                      <div className="min-w-0 flex-1">
                        <Select value={kind} onValueChange={changeKind}>
                          <SelectTrigger aria-label="Filtra per tipo" className="h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase"><SelectValue placeholder="Tipo" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tutti i documenti</SelectItem>
                            <SelectItem value="purchase">Acquisti</SelectItem>
                            <SelectItem value="order">Ordini</SelectItem>
                            {canSeeFatture && <SelectItem value="invoice">Fatture</SelectItem>}
                          </SelectContent>
                        </Select>
                      </div>
                      <button type="button" aria-label="Ordina per tipo" onClick={() => toggleSort("type")} className="shrink-0 text-slate-500 hover:text-slate-900">
                        <SortArrow active={sortKey === "type"} dir={sortDir} />
                      </button>
                    </div>
                  </TableHead>
                  <TableHead className={`w-36 ${headCls}`}>{sortBtn("number", "Numero")}</TableHead>
                  <TableHead className={`w-56 ${headCls}`}>
                    <div className="flex items-center gap-1">
                      <div className="min-w-0 flex-1">
                        <SearchableSelect
                          options={[{ value: "all", label: "Tutti i fornitori" }, ...suppliers.map(s => ({ value: s.id, label: s.name }))]}
                          value={supplierId}
                          onValueChange={changeSupplier}
                          placeholder="Fornitore"
                          searchPlaceholder="Scrivi per cercare fornitore..."
                          className="h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase"
                          contentClassName="min-w-[18rem]"
                        />
                      </div>
                      <button type="button" aria-label="Ordina per fornitore" onClick={() => toggleSort("supplier")} className="shrink-0 text-slate-500 hover:text-slate-900">
                        <SortArrow active={sortKey === "supplier"} dir={sortDir} />
                      </button>
                    </div>
                  </TableHead>
                  <TableHead className={`w-28 ${headCls}`}>{sortBtn("date", "Data")}</TableHead>
                  <TableHead className={headCls}>Articoli / bolle</TableHead>
                  {canSeeAmounts && <TableHead className={`w-32 text-right ${headCls}`}>{sortBtn("amount", "Importo")}</TableHead>}
                  <TableHead className="w-44 text-xs font-semibold uppercase tracking-wide text-slate-600">Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canSeeAmounts ? 7 : 6} className="py-10 text-center text-slate-400 dark:text-slate-500">
                      <FileText className="mx-auto mb-2 h-12 w-12 opacity-20" />
                      Nessun documento trovato
                    </TableCell>
                  </TableRow>
                ) : docs.map((d) => (
                  <TableRow key={`${d.kind}-${d.id}`} className="cursor-pointer" onClick={() => router.push(href(d))}>
                    <TableCell className="border-r py-2"><KindBadge kind={d.kind} /></TableCell>
                    <TableCell className="border-r py-2 font-medium text-slate-900 dark:text-white">{docNumber(d)}</TableCell>
                    <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">{docSupplier(d) || <span className="text-slate-300">—</span>}</TableCell>
                    <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">{new Date(docDate(d)).toLocaleDateString("it-IT")}</TableCell>
                    <TableCell className="border-r py-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="line-clamp-2" title={docDetail(d)}>{docDetail(d) || <span className="text-slate-300">—</span>}</span>
                    </TableCell>
                    {canSeeAmounts && (
                      <TableCell className="border-r py-2 text-right text-sm font-semibold text-slate-900 dark:text-white">
                        {docAmount(d) != null ? formatCurrency(Number(docAmount(d))) : "—"}
                      </TableCell>
                    )}
                    <TableCell className="py-2"><StateIcons doc={d} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Schede: telefono */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
            {docs.length === 0 ? (
              <div className="col-span-full py-10 text-center text-slate-400 dark:text-slate-500">
                <FileText className="mx-auto mb-2 h-12 w-12 opacity-20" />
                <p>Nessun documento trovato</p>
              </div>
            ) : docs.map((d) => (
              <Link href={href(d)} key={`${d.kind}-${d.id}`}>
                <Card className="h-full cursor-pointer border-slate-200 transition-shadow hover:shadow-md dark:border-slate-700">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1"><KindBadge kind={d.kind} /></div>
                        <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                          <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                          <span className="truncate">{docNumber(d)}</span>
                        </h3>
                        <p className="mt-1 flex items-center gap-1 truncate text-sm text-slate-500 dark:text-slate-400">
                          <User className="h-3 w-3 shrink-0" />
                          {docSupplier(d) || "Fornitore Sconosciuto"}
                        </p>
                      </div>
                      <div className="ml-2 shrink-0"><StateIcons doc={d} /></div>
                    </div>
                    <div className="mb-2">
                      {canSeeAmounts ? (
                        <div className="text-lg font-bold text-slate-900 dark:text-white">
                          {docAmount(d) != null ? formatCurrency(Number(docAmount(d))) : "-"}
                        </div>
                      ) : (
                        <span className="text-sm italic text-slate-400 dark:text-slate-500">Riservato</span>
                      )}
                    </div>
                    <div className="mb-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      <span>{new Date(docDate(d)).toLocaleDateString("it-IT")}</span>
                    </div>
                    {docDetail(d) && (
                      <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500">{docDetail(d)}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <PaginationControls
            page={page} totalPages={totalPages} loading={loading}
            onPageChange={setPage}
            totalItems={total}
            itemLabel="documenti"
          />
        </>
      )}

      {/* Pulsante «nuovo» sempre visibile (PC): passandoci sopra si divide in acquisto, ordine e fattura */}
      {canSeeAmounts && (
        <FloatingAddButton
          actions={[
            { href: "/purchases/new", label: "Nuovo acquisto" },
            { href: "/purchases/new?type=order", label: "Nuovo ordine" },
            { href: "/invoices/new", label: "Nuova fattura" },
          ]}
        />
      )}

      {convertOrder && (
        <ConvertOrdersModal
          open={!!convertOrder}
          onOpenChange={open => { if (!open) { setConvertOrder(null); load(); } }}
          triggerOrder={convertOrder}
        />
      )}
    </>
  );
}

export default function PurchasesPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento...</span>
        </div>
      }>
        <PurchasesPageContent />
      </Suspense>
    </DashboardLayout>
  );
}
