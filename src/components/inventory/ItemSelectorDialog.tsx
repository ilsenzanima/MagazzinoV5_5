import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { InventoryItem } from "@/lib/api";
import { memo } from "react";
import { ItemSearchPanel } from "@/components/inventory/ItemSearchPanel";

interface ItemSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: InventoryItem) => void;
  items: InventoryItem[];
  onSearch?: (term: string) => void;
  loading?: boolean;
  // Se presente compare «Non trovo il materiale» e riceve il testo cercato
  onCreateNew?: (searchTerm: string) => void;
}

export const ItemSelectorDialog = memo(function ItemSelectorDialog({ open, onOpenChange, onSelect, items, onSearch, loading, onCreateNew }: ItemSelectorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Seleziona Articolo</DialogTitle>
          <DialogDescription>
            Cerca e seleziona un articolo dall'inventario per aggiungerlo alla bolla.
          </DialogDescription>
        </DialogHeader>

        <ItemSearchPanel
          active={open}
          onSelect={onSelect}
          items={items}
          onSearch={onSearch}
          loading={loading}
          onCreateNew={onCreateNew}
        />
      </DialogContent>
    </Dialog>
  );
});
