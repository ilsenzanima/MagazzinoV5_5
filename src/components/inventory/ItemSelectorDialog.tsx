import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoryItem } from "@/lib/api";
import { Search, Package, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

interface ItemSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: InventoryItem) => void;
  items: InventoryItem[];
}

export function ItemSelectorDialog({ open, onOpenChange, onSelect, items }: ItemSelectorDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>(items);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    setFilteredItems(
      items.filter(
        (item) =>
          item.code.toLowerCase().includes(term) ||
          item.name.toLowerCase().includes(term) ||
          item.brand.toLowerCase().includes(term)
      )
    );
  }, [searchTerm, items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Seleziona Articolo</DialogTitle>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cerca per codice, nome o marca..."
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
                <TableHead className="text-right">Giacenza</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>Nessun articolo trovato</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onSelect(item)}>
                    <TableCell className="font-mono text-xs">{item.code}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-xs text-slate-500">{item.brand}</TableCell>
                    <TableCell className="text-right">
                        <Badge variant="outline" className={
                            item.quantity <= 0 ? "text-red-600 border-red-200 bg-red-50" :
                            item.quantity <= item.minStock ? "text-amber-600 border-amber-200 bg-amber-50" :
                            "text-slate-600"
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
}
