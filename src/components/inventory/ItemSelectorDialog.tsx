import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoryItem } from "@/lib/api";
import { Search, Package, Plus, Loader2 } from "lucide-react";
import { useState, useMemo, useDeferredValue, memo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

interface ItemSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: InventoryItem) => void;
  items: InventoryItem[];
  onSearch?: (term: string) => void;
  loading?: boolean;
}

export const ItemSelectorDialog = memo(function ItemSelectorDialog({ open, onOpenChange, onSelect, items, onSearch, loading }: ItemSelectorDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    if (open) setSearchTerm("");
  }, [open]);

  // Effect for server-side search
  useEffect(() => {
    if (onSearch) {
      const handler = setTimeout(() => {
        onSearch(searchTerm);
      }, 300);
      return () => clearTimeout(handler);
    }
  }, [searchTerm, onSearch]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Seleziona Articolo</DialogTitle>
          <DialogDescription>
            Cerca e seleziona un articolo dall'inventario per aggiungerlo alla bolla.
          </DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
});
