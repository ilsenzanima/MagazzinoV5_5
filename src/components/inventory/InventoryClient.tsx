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
  ChevronRight,
  Package,
  ScanLine,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { InventoryItem } from "@/lib/mock-data";
import { inventoryApi, itemTypesApi, ItemType } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
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

interface InventoryClientProps {
  initialItems: InventoryItem[];
  initialTotal: number;
  initialTypes: ItemType[];
}

function InventoryItemImage({ item, typeInfo }: { item: InventoryItem; typeInfo?: ItemType }) {
  const [imgError, setImgError] = useState(false);
  const hasCustomImage = !!item.image && !imgError;
  const hasTypeImage = !!typeInfo?.imageUrl;
  const imageUrl = hasCustomImage ? item.image! : (typeInfo?.imageUrl || "/placeholder.svg");
  const objectFitClass = (hasCustomImage || (!imgError && hasTypeImage))
    ? "object-cover group-hover:scale-105"
    : "object-contain p-8 opacity-50";

  return (
    <Image
      src={imageUrl}
      alt={item.name}
      fill
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
      className={`transition-transform duration-300 ${objectFitClass} ${item.quantity === 0 ? "grayscale opacity-80" : ""}`}
      onError={() => setImgError(true)}
    />
  );
}

export default function InventoryClient({ initialItems, initialTotal, initialTypes }: InventoryClientProps) {
  const { userRole } = useAuth();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "all";

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isScanning, setIsScanning] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [itemTypes, setItemTypes] = useState<ItemType[]>(initialTypes);
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false); // Initial loading is false because we have props
  const [error, setError] = useState<string | null>(null);
  const [pendingMap, setPendingMap] = useState<Map<string, { uscita: number; reso: number }>>(new Map());

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(12); // Grid layout: 1, 2, 3, 4 cols
  const [totalPages, setTotalPages] = useState(Math.ceil(initialTotal / 12) || 1);
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

  // Load items when dependencies change
  useEffect(() => {
    // Skip first load if parameters match initial props
    // This prevents double fetching on mount
    if (page === 1 && debouncedSearchTerm === "" && activeTab === "all" && selectedBrand === "all" && selectedType === "all" && items === initialItems) {
      return;
    }

    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearchTerm, activeTab, selectedBrand, selectedType]);

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
        type: selectedType !== "all" ? selectedType : undefined
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
              <Link href="/inventory/new" className="w-full sm:w-auto">
                <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuovo Articolo
                </Button>
              </Link>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant={activeFiltersCount > 0 ? "secondary" : "ghost"} size="icon" className="shrink-0 relative" aria-label="Filtra">
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
          <Button variant="outline" size="icon" onClick={() => setIsScanning(true)} title="Scansiona Barcode/QR" aria-label="Scansiona Barcode/QR">
            <ScanLine className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" value={activeTab} onValueChange={(val) => { setActiveTab(val); setPage(1); }} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-100 dark:bg-muted">
            <TabsTrigger value="all">Tutti</TabsTrigger>
            <TabsTrigger value="low_stock" className="data-[state=active]:text-amber-600">Basse Scorte</TabsTrigger>
            <TabsTrigger value="out_of_stock" className="data-[state=active]:text-red-600">Esauriti</TabsTrigger>
          </TabsList>
        </Tabs>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                                  {(item.quantity / item.coefficient).toLocaleString('it-IT', { maximumFractionDigits: 2 })} pz =
                                </span>
                                <Badge variant="outline" className={
                                  item.quantity === 0 ? "text-red-600 border-red-200 bg-red-50" :
                                    item.quantity <= item.minStock ? "text-amber-600 border-amber-200 bg-amber-50" :
                                      "text-slate-600"
                                }>
                                  {item.quantity.toLocaleString('it-IT', { maximumFractionDigits: 2 })} {item.unit}
                                </Badge>
                              </>
                            ) : (
                              <Badge variant="outline" className={
                                item.quantity === 0 ? "text-red-600 border-red-200 bg-red-50" :
                                  item.quantity <= item.minStock ? "text-amber-600 border-amber-200 bg-amber-50" :
                                    "text-slate-600"
                              }>
                                {item.quantity.toLocaleString('it-IT', { maximumFractionDigits: 2 })} {item.unit}
                              </Badge>
                            )}
                            {(() => {
                              const pending = pendingMap.get(item.id);
                              if (!pending || (pending.uscita === 0 && pending.reso === 0)) return null;
                              return (
                                <>
                                  {pending.uscita > 0 && (
                                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
                                      ↑ {pending.uscita.toLocaleString('it-IT', { maximumFractionDigits: 2 })} uscita
                                    </Badge>
                                  )}
                                  {pending.reso > 0 && (
                                    <Badge variant="outline" className="text-[10px] text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20">
                                      ↓ {pending.reso.toLocaleString('it-IT', { maximumFractionDigits: 2 })} entrata
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

          {/* Pagination Controls */}
          {items.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-8 border-t pt-4 dark:border-border gap-4">
              <div className="text-sm text-slate-500 dark:text-slate-400 order-2 sm:order-1">
                Pagina {page} di {totalPages} ({totalItems} articoli)
              </div>
              <div className="flex gap-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Precedente
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Successiva
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Floating Action Button (FAB) */}
      {(userRole === 'admin' || userRole === 'operativo') && (
        <div className="hidden md:block fixed bottom-10 right-10 z-20">
          <Link href="/inventory/new">
            <Button className="h-14 w-14 md:h-14 md:w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 touch-target">
              <Plus className="h-8 w-8" />
            </Button>
          </Link>
        </div>
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
