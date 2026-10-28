"use client"

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Image from "next/image"; // Import Next.js Image component
import {
  Search,
  Filter,
  Plus,
  ChevronLeft,
  Package,
  ScanLine,
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from "lucide-react";
import { FloatingAddButton } from "@/components/ui/floating-add-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Articoli per pagina: fisso, uguale per tutti
const PAGE_SIZE = 50;
import { PaginationControls } from "@/components/ui/pagination-controls";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { InventoryItem } from "@/lib/mock-data";
import { inventoryApi, itemTypesApi, ItemType } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { notify } from "@/lib/notify";
import type { Html5Qrcode } from "html5-qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brandsApi, Brand } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { loadNotesService } from "@/lib/services/load-notes";
import { warehousesApi } from "@/lib/services/warehouses";
import type { Warehouse } from "@/lib/types";

interface InventoryClientProps {
  initialItems: InventoryItem[];
  initialTotal: number;
  initialTypes: ItemType[];
}

function InventoryItemImage({ item, typeInfo, thumb }: { item: InventoryItem; typeInfo?: ItemType; thumb?: boolean }) {
  const [imgError, setImgError] = useState(false);
  const hasCustomImage = !!item.image && !imgError;
  const hasTypeImage = !!typeInfo?.imageUrl;
  const imageUrl = hasCustomImage ? item.image! : (typeInfo?.imageUrl || "/placeholder.svg");
  const objectFitClass = (hasCustomImage || (!imgError && hasTypeImage))
    ? (thumb ? "object-cover" : "object-cover group-hover:scale-105")
    : (thumb ? "object-contain p-1.5 opacity-50" : "object-contain p-8 opacity-50");

  return (
    <Image
      src={imageUrl}
      alt={item.name}
      fill
      sizes={thumb ? "40px" : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"}
      className={`transition-transform duration-300 ${objectFitClass} ${item.quantity === 0 ? "grayscale opacity-80" : ""}`}
      onError={() => setImgError(true)}
    />
  );
}

export default function InventoryClient({ initialItems, initialTotal, initialTypes }: InventoryClientProps) {
  const { userRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "all";
  const initialSearch = searchParams.get("q") || "";
  const initialBrand = searchParams.get("brand") || "all";
  const initialType = searchParams.get("type") || "all";
  const initialWarehouse = searchParams.get("wh") || "all";
  const initialPage = Number(searchParams.get("page")) || 1;
  const initialSort = searchParams.get("sort") || "name";
  const initialDir: "asc" | "desc" = searchParams.get("dir") === "desc" ? "desc" : "asc";

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialSearch);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isScanning, setIsScanning] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [itemTypes, setItemTypes] = useState<ItemType[]>(initialTypes);
  const [selectedBrand, setSelectedBrand] = useState<string>(initialBrand);
  const [selectedType, setSelectedType] = useState<string>(initialType);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(initialWarehouse);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false); // Initial loading is false because we have props
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>(initialSort);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialDir);
  const [stockMap, setStockMap] = useState<Map<string, { warehouseId: string; quantity: number }[]>>(new Map());
  const [pendingMap, setPendingMap] = useState<Map<string, { uscita: number; reso: number }>>(new Map());

  // Pagination state
  const [page, setPage] = useState(initialPage);
  const limit = PAGE_SIZE;
  const [totalPages, setTotalPages] = useState(Math.ceil(initialTotal / PAGE_SIZE) || 1);
  const [totalItems, setTotalItems] = useState(initialTotal);

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      if (searchTerm !== debouncedSearchTerm) {
        setPage(1); // Reset to first page on new search
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm, debouncedSearchTerm]);

  // Keep the URL in sync with tab/search/filters/page so browser back/forward
  // restores the exact view instead of resetting it.
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== "all") params.set("tab", activeTab);
    if (debouncedSearchTerm) params.set("q", debouncedSearchTerm);
    if (selectedBrand !== "all") params.set("brand", selectedBrand);
    if (selectedType !== "all") params.set("type", selectedType);
    if (selectedWarehouse !== "all") params.set("wh", selectedWarehouse);
    if (page !== 1) params.set("page", String(page));
    if (sortKey !== "name") params.set("sort", sortKey);
    if (sortDir !== "asc") params.set("dir", sortDir);
    const query = params.toString();
    router.replace(query ? `/inventory?${query}` : "/inventory", { scroll: false });
  }, [activeTab, debouncedSearchTerm, selectedBrand, selectedType, selectedWarehouse, page, sortKey, sortDir, router]);

  // Load warehouses for the location tabs
  useEffect(() => {
    warehousesApi.getAll().then(setWarehouses).catch(console.error);
  }, []);

  // Load types if not provided (fallback)
  useEffect(() => {
    if (itemTypes.length === 0) {
      itemTypesApi.getAll().then(setItemTypes).catch(console.error);
    }
  }, [itemTypes.length]);

  // Load brands
  useEffect(() => {
    brandsApi.getAll().then(setBrands).catch(console.error);
  }, []);

  // In quali magazzini si trova ogni articolo della pagina
  useEffect(() => {
    let cancelled = false;
    inventoryApi.getStockByWarehouse(items.map(i => i.id))
      .then(map => { if (!cancelled) setStockMap(map); })
      .catch(console.error);
    return () => { cancelled = true; };
  }, [items]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const warehouseName = (id: string) => warehouses.find(w => w.id === id)?.name ?? "";

  // Load pending notes and build per-item map
  useEffect(() => {
    loadNotesService.getAll({ status: 'pending' }).then(notes => {
      const map = new Map<string, { uscita: number; reso: number }>();
      notes.forEach(note => {
        note.items.forEach(noteItem => {
          const existing = map.get(noteItem.inventoryId) || { uscita: 0, reso: 0 };
          if (note.noteType === 'uscita') existing.uscita += noteItem.quantity;
          else existing.reso += noteItem.quantity;
          map.set(noteItem.inventoryId, existing);
        });
      });
      setPendingMap(map);
    }).catch(console.error);
  }, []);

  const resetFilters = () => {
    setSelectedBrand("all");
    setSelectedType("all");
    setSearchTerm("");
  };

  const activeFiltersCount = (selectedBrand !== "all" ? 1 : 0) + (selectedType !== "all" ? 1 : 0);

  // Solo le sedi fisiche di stoccaggio (principale + operativa) diventano tab:
  // altre voci anagrafiche nella tabella magazzini (es. sede legale) non sono
  // mai destinazione reale di merce.
  const stockWarehouses = warehouses.filter((w) => w.isPrimary || /operativ/i.test(w.name));

  // Load items when dependencies change
  useEffect(() => {
    // Skip first load if parameters match initial props
    // This prevents double fetching on mount
    if (page === 1 && debouncedSearchTerm === "" && activeTab === "all" && selectedBrand === "all" && selectedType === "all" && selectedWarehouse === "all" && sortKey === "name" && sortDir === "asc" && items === initialItems) {
      return;
    }

    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearchTerm, activeTab, selectedBrand, selectedType, selectedWarehouse, sortKey, sortDir]);

  const loadItems = async () => {
    try {
      setLoading(true);
      setError(null);

      // Server-side pagination for ALL tabs (including low_stock via RPC)
      const { items: paginatedItems, total } = await inventoryApi.getPaginated({
        page,
        limit,
        search: debouncedSearchTerm,
        tab: activeTab,
        brand: selectedBrand !== "all" ? selectedBrand : undefined,
        type: selectedType !== "all" ? selectedType : undefined,
        warehouseId: selectedWarehouse !== "all" ? selectedWarehouse : undefined,
        sort: sortKey,
        dir: sortDir
      });
      setItems(paginatedItems);
      setTotalItems(total);
      setTotalPages(Math.ceil(total / limit) || 1);

    } catch (error: any) {
      console.error("Failed to load inventory:", error);
      setError(error.message || "Errore sconosciuto durante il caricamento inventario");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isScanning) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(async () => {
        try {
          // Check if element exists
          if (document.getElementById("reader")) {
            // Initialize scanner dynamically to avoid SSR issues
            const { Html5Qrcode } = await import("html5-qrcode");

            const html5QrCode = new Html5Qrcode("reader");
            scannerRef.current = html5QrCode;

            // Start scanning
            await html5QrCode.start(
              { facingMode: "environment" }, // Prefer back camera
              {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
              },
              (decodedText) => {
                setSearchTerm(decodedText);
                setIsScanning(false);
              },
              (errorMessage) => {
                // ignore parsing errors
              }
            );
          }
        } catch (err) {
          console.error("Scanner setup error", err);
          notify.error("Impossibile avviare la fotocamera per lo scanner");
        }
      }, 200);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          scannerRef.current.stop().then(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
          }).catch((err) => {
            console.error("Failed to stop scanner", err);
            scannerRef.current?.clear();
            scannerRef.current = null;
          });
        }
      };
    }
  }, [isScanning]);

  return (
    <DashboardLayout>

      {/* Header Fisso */}
      <div className="bg-white dark:bg-card p-4 shadow-sm sticky top-0 z-10 space-y-4 rounded-lg mb-6 border dark:border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link href="/dashboard" className="md:hidden">
              <Button variant="ghost" size="icon" className="-ml-2" aria-label="Torna indietro">
                <ChevronLeft className="h-6 w-6 text-slate-600 dark:text-slate-400" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Gestione Inventario</h1>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {(userRole === 'admin' || userRole === 'operativo') && (
              <Link href="/inventory/new" className="w-full sm:w-auto md:hidden">
                <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuovo Articolo
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <Label htmlFor="inventory-search" className="sr-only">Cerca articoli</Label>
            <Input
              id="inventory-search"
              name="search"
              type="search"
              autoComplete="off"
              placeholder="Cerca Articoli (Nome, Codice, Marca, Tipologia...)"
              className="pl-9 bg-slate-100 dark:bg-muted border-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant={activeFiltersCount > 0 ? "secondary" : "outline"} size="icon" className="shrink-0 relative" aria-label="Filtra">
              <Filter className={`h-5 w-5 ${activeFiltersCount > 0 ? "text-blue-600" : "text-slate-600 dark:text-slate-400"}`} />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] grid place-items-center h-4 w-4 rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filtri Avanzati</SheetTitle>
              <SheetDescription>
                Affina la ricerca per trovare specifici articoli.
              </SheetDescription>
            </SheetHeader>
            <div className="py-6 space-y-6">
              {/* Brand Filter */}
              <div className="space-y-2">
                <Label>Marca</Label>
                <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutte le marche" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le marche</SelectItem>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type Filter */}
              <div className="space-y-2">
                <Label>Tipologia</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutte le tipologie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le tipologie</SelectItem>
                    {itemTypes.map((t) => (
                      <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <SheetFooter>
              <SheetClose asChild>
                <Button variant="outline" onClick={resetFilters}>Resetta</Button>
              </SheetClose>
              <SheetClose asChild>
                <Button>Chiudi</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
          <Button variant="outline" size="icon" onClick={() => setIsScanning(true)} title="Scansiona Barcode/QR" aria-label="Scansiona Barcode/QR">
            <ScanLine className="h-4 w-4" />
          </Button>
        </div>

        {/* Telefono: magazzino e scorte in due menu sulla stessa riga */}
        <div className="grid grid-cols-2 gap-2 md:hidden">
          {stockWarehouses.length > 1 ? (
            <Select value={selectedWarehouse} onValueChange={(val) => { setSelectedWarehouse(val); setPage(1); }}>
              <SelectTrigger aria-label="Magazzino"><SelectValue placeholder="Magazzino" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i magazzini</SelectItem>
                {stockWarehouses.map((w) => (<SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>))}
              </SelectContent>
            </Select>
          ) : <div />}
          <Select value={activeTab} onValueChange={(val) => { setActiveTab(val); setPage(1); }}>
            <SelectTrigger aria-label="Scorte"><SelectValue placeholder="Scorte" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le scorte</SelectItem>
              <SelectItem value="low_stock">Basse scorte</SelectItem>
              <SelectItem value="out_of_stock">Esauriti</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista Articoli */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento inventario...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col justify-center items-center py-12 text-center">
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-full mb-4">
            <Package className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Errore di Caricamento</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">{error}</p>
          <Button onClick={loadItems} variant="outline">
            Riprova
          </Button>
        </div>
      ) : (
        <>
          {/* Tabella: da tablet in su */}
          <div className="mb-4 hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
            <Table className="border-collapse">
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                  <TableHead className="w-14 border-r" />
                  <TableHead className="w-28 border-r text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <button type="button" onClick={() => toggleSort("code")} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
                      Codice
                      {sortKey === "code" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </button>
                  </TableHead>
                  <TableHead className=" border-r text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
                      Nome
                      {sortKey === "name" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </button>
                  </TableHead>
                  <TableHead className="w-44 border-r text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <button type="button" onClick={() => toggleSort("model")} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
                      Modello / variante
                      {sortKey === "model" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </button>
                  </TableHead>
                  <TableHead className="w-32 border-r text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <button type="button" onClick={() => toggleSort("brand")} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
                      Marca
                      {sortKey === "brand" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </button>
                  </TableHead>
                  <TableHead className="w-36 border-r text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <button type="button" onClick={() => toggleSort("type")} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
                      Tipologia
                      {sortKey === "type" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </button>
                  </TableHead>
                  <TableHead className="w-44 border-r text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {stockWarehouses.length > 1 ? (
                      <Select value={selectedWarehouse} onValueChange={(val) => { setSelectedWarehouse(val); setPage(1); }}>
                        <SelectTrigger aria-label="Filtra per magazzino" className="h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase"><SelectValue placeholder="Magazzino" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutti i magazzini</SelectItem>
                          {stockWarehouses.map((w) => (<SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    ) : "Magazzino"}
                  </TableHead>
                  <TableHead className="w-32 text-right border-r text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <button type="button" onClick={() => toggleSort("quantity")} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
                      Giacenza
                      {sortKey === "quantity" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </button>
                  </TableHead>
                  <TableHead className="w-24 text-right border-r text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <button type="button" onClick={() => toggleSort("min_stock")} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
                      Scorta min.
                      {sortKey === "min_stock" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </button>
                  </TableHead>
                  <TableHead className="w-36 border-r text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <Select value={activeTab} onValueChange={(val) => { setActiveTab(val); setPage(1); }}>
                      <SelectTrigger aria-label="Filtra per riordino" className="h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase"><SelectValue placeholder="Riordino" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti</SelectItem>
                        <SelectItem value="low_stock">Da riordinare</SelectItem>
                        <SelectItem value="out_of_stock">Esauriti</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead className="w-32 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Da processare</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-10 text-center text-slate-400 dark:text-slate-500">
                      <Package className="mx-auto mb-2 h-12 w-12 opacity-20" />
                      <p>Nessun articolo trovato</p>
                    </TableCell>
                  </TableRow>
                ) : items.map((item) => {
                  const qtyColor = item.quantity === 0 ? 'text-red-600'
                    : item.quantity <= item.minStock ? 'text-amber-600'
                    : 'text-slate-800 dark:text-slate-200';
                  const pending = pendingMap?.get(item.id);
                  return (
                    <TableRow key={item.id} className="cursor-pointer" onClick={() => router.push(`/inventory/${item.id}`)}>
                      <TableCell className="border-r py-1.5">
                        <div className="relative h-10 w-10 overflow-hidden rounded border bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                          <InventoryItemImage item={item} typeInfo={itemTypes.find(t => t.name === item.type)} thumb />
                        </div>
                      </TableCell>
                      <TableCell className="border-r py-2 font-mono text-xs text-slate-500">{item.code}</TableCell>
                      <TableCell className="border-r py-2 font-medium text-slate-900 dark:text-white">
                        <Link href={`/inventory/${item.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{item.name}</Link>
                      </TableCell>
                      <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">{item.model || <span className="text-slate-300">—</span>}</TableCell>
                      <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">{item.brand}</TableCell>
                      <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">{item.type}</TableCell>
                      <TableCell className="border-r py-2 text-xs text-slate-600 dark:text-slate-300">
                        {(() => {
                          const where = stockMap.get(item.id) || [];
                          if (where.length === 0) return <span className="text-slate-300">—</span>;
                          return where.map(w => (
                            <div key={w.warehouseId} className="flex justify-between gap-2">
                              <span className="truncate">{warehouseName(w.warehouseId)}</span>
                              <span className="shrink-0 text-slate-400">{w.quantity.toLocaleString('it-IT', { maximumFractionDigits: 2 })}</span>
                            </div>
                          ));
                        })()}
                      </TableCell>
                      <TableCell className={`border-r py-2 text-right text-sm font-semibold ${qtyColor}`}>
                        {item.quantity.toLocaleString('it-IT', { maximumFractionDigits: 2, useGrouping: true })} {item.unit}
                        {item.coefficient !== 1 && (
                          <div className="text-[11px] font-normal text-slate-400">{(item.quantity / item.coefficient).toLocaleString('it-IT', { maximumFractionDigits: 2, useGrouping: true })} pz</div>
                        )}
                      </TableCell>
                      <TableCell className="border-r py-2 text-right text-sm text-slate-500">{item.minStock ? item.minStock.toLocaleString('it-IT', { maximumFractionDigits: 2 }) : <span className="text-slate-300">—</span>}</TableCell>
                      <TableCell className="border-r py-2 text-xs">
                        {item.quantity <= 0 ? (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-medium text-red-600">Esaurito</span>
                        ) : item.quantity <= item.minStock ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-600">Da riordinare</span>
                        ) : (
                          <span className="text-slate-400">OK</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-right text-xs">
                        {pending && pending.uscita > 0 && (
                          <div className="text-amber-600">↑ {pending.uscita.toLocaleString('it-IT', { maximumFractionDigits: 2, useGrouping: true })} uscita</div>
                        )}
                        {pending && pending.reso > 0 && (
                          <div className="text-green-600">↓ {pending.reso.toLocaleString('it-IT', { maximumFractionDigits: 2, useGrouping: true })} entrata</div>
                        )}
                        {!(pending && (pending.uscita > 0 || pending.reso > 0)) && <span className="text-slate-300">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Schede: telefono */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
            {items.length === 0 ? (
              <div className="col-span-full text-center py-10 text-slate-400 dark:text-slate-500">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nessun articolo trovato</p>
              </div>
            ) : (
              items.map((item) => (
                <Link href={`/inventory/${item.id}`} key={item.id}>
                  <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group h-full">
                    <CardContent className="p-0 flex flex-col h-full">
                      {/* Immagine */}
                      <div className="w-full h-48 shrink-0 relative flex items-center justify-center bg-card overflow-hidden">
                        <InventoryItemImage
                          item={item}
                          typeInfo={itemTypes.find(t => t.name === item.type)}
                        />

                        {item.quantity === 0 && (
                          <div className="absolute inset-0 bg-white/10 flex items-center justify-center z-10">
                            <Badge variant="destructive" className="text-sm font-bold shadow-sm">ESAURITO</Badge>
                          </div>
                        )}
                      </div>

                      {/* Dettagli */}
                      <div className="flex-1 p-3 sm:p-4 flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-1">{item.code}</p>
                            <h3 className="font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight" title={item.name}>
                              {item.name}
                              {item.model && <span className="text-slate-500 dark:text-slate-400 font-medium ml-1">({item.model})</span>}
                            </h3>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1 mt-auto pt-2">
                          <Badge variant="secondary" className="text-[10px] font-normal text-slate-600 dark:text-slate-400">
                            {item.brand}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] font-normal text-slate-600 dark:text-slate-400">
                            {item.type}
                          </Badge>
                          <div className="ml-auto text-right flex flex-col items-end gap-1">
                            {item.coefficient !== 1 ? (
                              <>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mr-1">
                                  {(item.quantity / item.coefficient).toLocaleString('it-IT', { maximumFractionDigits: 2 , useGrouping: true})} pz =
                                </span>
                                <Badge variant="outline" className={
                                  item.quantity === 0 ? "text-red-600 border-red-200 bg-red-50" :
                                    item.quantity <= item.minStock ? "text-amber-600 border-amber-200 bg-amber-50" :
                                      "text-slate-600"
                                }>
                                  {item.quantity.toLocaleString('it-IT', { maximumFractionDigits: 2 , useGrouping: true})} {item.unit}
                                </Badge>
                              </>
                            ) : (
                              <Badge variant="outline" className={
                                item.quantity === 0 ? "text-red-600 border-red-200 bg-red-50" :
                                  item.quantity <= item.minStock ? "text-amber-600 border-amber-200 bg-amber-50" :
                                    "text-slate-600"
                              }>
                                {item.quantity.toLocaleString('it-IT', { maximumFractionDigits: 2 , useGrouping: true})} {item.unit}
                              </Badge>
                            )}
                            {(() => {
                              const pending = pendingMap.get(item.id);
                              if (!pending || (pending.uscita === 0 && pending.reso === 0)) return null;
                              return (
                                <>
                                  {pending.uscita > 0 && (
                                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
                                      ↑ {pending.uscita.toLocaleString('it-IT', { maximumFractionDigits: 2 , useGrouping: true})} uscita
                                    </Badge>
                                  )}
                                  {pending.reso > 0 && (
                                    <Badge variant="outline" className="text-[10px] text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20">
                                      ↓ {pending.reso.toLocaleString('it-IT', { maximumFractionDigits: 2 , useGrouping: true})} entrata
                                    </Badge>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
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
            totalItems={totalItems}
            itemLabel="articoli"
          />
        </>
      )}

      {/* Pulsante «Aggiungi articolo» sempre visibile (PC) */}
      {(userRole === 'admin' || userRole === 'operativo') && (
        <FloatingAddButton href="/inventory/new" label="Aggiungi articolo" />
      )}

      {/* Scanner Dialog */}
      <Dialog open={isScanning} onOpenChange={setIsScanning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scansiona Codice</DialogTitle>
            <DialogDescription>
              Inquadra il codice a barre o il QR code per cercare l&apos;articolo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div id="reader" className="w-full"></div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
