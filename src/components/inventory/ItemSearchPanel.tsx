import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoryItem } from "@/lib/api";
import { Search, Package, Plus, Loader2 } from "lucide-react";
import { useState, useMemo, useDeferredValue, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

export interface ItemSearchPanelProps {
  active: boolean;                       // vero quando il pannello è visibile: riparte da una ricerca vuota
  onSelect: (item: InventoryItem) => void;
  items: InventoryItem[];
  onSearch?: (term: string) => void;
  loading?: boolean;
  // Se presente compare «Non trovo il materiale» e riceve il testo cercato
  onCreateNew?: (searchTerm: string) => void;
}

// Ricerca e scelta di un articolo dell'inventario (usata dal modale classico e dal modale a pagine degli acquisti)
export function ItemSearchPanel({ active, onSelect, items, onSearch, loading, onCreateNew }: ItemSearchPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    if (active) setSearchTerm("");
  }, [active]);

  // Effect for server-side search
  useEffect(() => {
    if (onSearch && active) {
      const handler = setTimeout(() => {
        onSearch(searchTerm);
      }, 300);
      return () => clearTimeout(handler);
    }
  }, [searchTerm, onSearch, active]);

  const filteredItems = useMemo(() => {
    // If server-side search is enabled, assume items are already filtered
    if (onSearch) return items;

    const term = deferredSearchTerm.toLowerCase();
    if (!term) return items;

    return items.filter(
      (item) =>
        item.code.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        item.brand.toLowerCase().includes(term) ||
        item.type.toLowerCase().includes(term) ||
        (item.model?.toLowerCase().includes(term) ?? false) ||
        (item.supplierCode?.toLowerCase().includes(term) ?? false)
    );
  }, [items, deferredSearchTerm, onSearch]);

  return (
    <>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
        <Input
          placeholder="Cerca per codice, nome, variante, marca..."
          className="pl-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
        />
      </div>

      {onCreateNew && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">Il materiale non c&apos;è nell&apos;elenco?</span>
          <Button size="sm" variant="outline" onClick={() => onCreateNew(searchTerm)}>
            <Plus className="mr-1 h-4 w-4" /> Non trovo il materiale: crealo
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Codice</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead className="text-center">Verifica Inv.</TableHead>
              <TableHead className="text-right">Giacenza</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400 dark:text-slate-500">
                  <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
                  <p>Caricamento...</p>
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400 dark:text-slate-500">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nessun articolo trovato</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => onSelect(item)}>
                  <TableCell className="font-mono text-xs">{item.code}</TableCell>
                  <TableCell className="font-medium">
                    {item.name}
                    {item.model && <span className="text-slate-400 dark:text-slate-500 font-normal"> ({item.model})</span>}
                    {item.packQuantity ? (
                      <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                        confezione: {item.packQuantity} {item.unit}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 dark:text-slate-400">{item.brand}</TableCell>
                  <TableCell className="text-center">
                    {item.realQuantity !== undefined && item.realQuantity !== null ? (
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-medium">{item.realQuantity} pz</span>
                        {item.quantity !== undefined && item.realQuantity !== item.quantity && (
                          <span className={`text-xs font-bold ${item.realQuantity > item.quantity ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {item.realQuantity > item.quantity ? '+' : ''}{(item.realQuantity - item.quantity).toFixed(0)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={
                      item.quantity <= 0 ? "text-red-600 border-red-200 bg-red-50" :
                        item.quantity <= item.minStock ? "text-amber-600 border-amber-200 bg-amber-50" :
                          "text-slate-600 dark:text-slate-400"
                    }>
                      {item.quantity} {item.unit}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
