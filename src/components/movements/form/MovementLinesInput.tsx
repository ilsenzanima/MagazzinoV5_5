import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, Plus } from "lucide-react";
import { InventoryItem } from "@/lib/types";
import { ItemSelectorDialog } from "@/components/inventory/ItemSelectorDialog";
import { format } from "date-fns";

interface MovementLinesInputProps {
    currentLine: any;
    setCurrentLine: (val: any) => void;
    selectedItem: InventoryItem | null;
    onItemSelect: (item: InventoryItem) => void;
    onAddLine: () => void;
    availableBatches: any[];
    activeTab: string;
    // Dialog props
    isItemSelectorOpen: boolean;
    setIsItemSelectorOpen: (v: boolean) => void;
    inventory: InventoryItem[];
    onItemSearch: (term: string) => Promise<void>;
    itemsLoading: boolean;
}

export function MovementLinesInput({
    currentLine, setCurrentLine,
    selectedItem, onItemSelect, onAddLine,
    availableBatches, activeTab,
    isItemSelectorOpen, setIsItemSelectorOpen,
    inventory, onItemSearch, itemsLoading
}: MovementLinesInputProps) {

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Inserimento Righe
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="flex-1 justify-start text-left"
                        onClick={() => setIsItemSelectorOpen(true)}
                    >
                        {selectedItem ? (
                            <span className="truncate">
                                <span className="font-bold">{selectedItem.code}</span>
                                <span className="mx-2">-</span>
                                {selectedItem.name}
                            </span>
                        ) : (
                            <span className="text-slate-400">Seleziona Articolo...</span>
                        )}
                    </Button>
                </div>

                <ItemSelectorDialog
                    open={isItemSelectorOpen}
                    onOpenChange={setIsItemSelectorOpen}
                    onSelect={onItemSelect}
                    items={inventory}
                    onSearch={onItemSearch}
                    loading={itemsLoading}
                />

                {/* If Exit or Sale, Show Batches */}
                {(activeTab === 'exit' || activeTab === 'sale') && selectedItem && availableBatches.length > 0 && (
                    <div className="space-y-2">
                        <Label className="text-xs">Seleziona Lotto (FIFO)</Label>
                        <Select
                            value={currentLine.purchaseItemId}
                            onValueChange={(val) => setCurrentLine({ ...currentLine, purchaseItemId: val })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleziona lotto..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableBatches.map(batch => (
                                    <SelectItem key={batch.id} value={batch.id}>
                                        {batch.purchaseRef || "Nessun Rif."} - Pz: {batch.remainingPieces ?? '-'} / Q.tà: {batch.remainingQty} ({format(new Date(batch.date), 'dd/MM/yy')})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Checkbox Fittizi per Uscite/Vendite */}
                {(activeTab === 'exit' || activeTab === 'sale') && selectedItem && (
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="fictitiousExit"
                            checked={currentLine.isFictitious || false}
                            onCheckedChange={(c) => setCurrentLine({ ...currentLine, isFictitious: c as boolean })}
                        />
                        <Label htmlFor="fictitiousExit" className="text-xs cursor-pointer">Fittizio (non scalare da magazzino)</Label>
                    </div>
                )}

                {/* Checkbox Fittizi per Entrate */}
                {activeTab === 'entry' && selectedItem && (
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="fictitiousEntry"
                            checked={currentLine.isFictitious || false}
                            onCheckedChange={(c) => setCurrentLine({ ...currentLine, isFictitious: c as boolean })}
                        />
                        <Label htmlFor="fictitiousEntry" className="text-xs cursor-pointer">Fittizio (solo in bolla, non in giacenza)</Label>
                    </div>
                )}

                <div className="grid grid-cols-5 gap-4">
                    <div className="space-y-2">
                        <Label>Pezzi</Label>
                        <Input
                            type="number"
                            placeholder="0"
                            step="0.01"
                            value={currentLine.pieces || ""}
                            onChange={e => {
                                const piecesStr = e.target.value;
                                const pieces = parseFloat(piecesStr);
                                const coef = currentLine.coefficient || 1;

                                if (!isNaN(pieces) && coef > 0) {
                                    const quantity = (pieces * coef).toFixed(2);
                                    setCurrentLine({ ...currentLine, pieces: piecesStr, quantity });
                                } else {
                                    setCurrentLine({ ...currentLine, pieces: piecesStr });
                                }
                            }}
                        />
                        <p className="text-xs text-muted-foreground">Coeff: {currentLine.coefficient}</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Quantità ({currentLine.unit})</Label>
                        <Input
                            type="number"
                            placeholder="0"
                            step="0.01"
                            value={currentLine.quantity}
                            onChange={e => {
                                const quantityStr = e.target.value;
                                const quantity = parseFloat(quantityStr);
                                const coef = currentLine.coefficient || 1;

                                if (!isNaN(quantity) && coef > 0 && coef !== 1) {
                                    const pieces = (quantity / coef).toFixed(2);
                                    setCurrentLine({ ...currentLine, quantity: quantityStr, pieces });
                                } else if (!isNaN(quantity) && coef === 1) {
                                    setCurrentLine({ ...currentLine, quantity: quantityStr, pieces: quantityStr });
                                } else {
                                    setCurrentLine({ ...currentLine, quantity: quantityStr });
                                }
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>U.M.</Label>
                        <Input value={currentLine.unit} readOnly className="bg-slate-50" />
                    </div>
                    <div className="col-span-2 flex items-end">
                        <Button onClick={onAddLine} className="w-full">
                            <Plus className="h-4 w-4 mr-2" />
                            Aggiungi
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
