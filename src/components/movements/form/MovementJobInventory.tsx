import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { useState } from "react";

interface MovementJobInventoryProps {
    jobBatchAvailability: any[];
    onSelectBatch: (batch: any) => void;
}

export function MovementJobInventory({ jobBatchAvailability, onSelectBatch }: MovementJobInventoryProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    if (jobBatchAvailability.length === 0) return null;

    const filteredBatches = jobBatchAvailability.filter(batch => {
        if (!searchTerm.trim()) return true
        const words = searchTerm.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0)
        if (words.length === 0) return true
        const searchTarget = `${batch.itemName} ${batch.itemCode} ${batch.itemModel || ''}`.toLowerCase()
        return words.every(word => searchTarget.includes(word))
    });

    const handleSelect = (batch: any) => {
        onSelectBatch(batch);
        setIsOpen(false);
        setSearchTerm("");
    };

    return (
        <>
            <Card className="bg-slate-50 dark:bg-muted border-blue-100 dark:border-blue-900">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-300">Materiale in Carico sulla Commessa</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button
                        variant="outline"
                        className="w-full justify-start text-left"
                        onClick={() => setIsOpen(true)}
                    >
                        <Search className="mr-2 h-4 w-4" />
                        <span className="text-slate-600 dark:text-slate-300">
                            Cerca tra {jobBatchAvailability.length} articoli in cantiere...
                        </span>
                    </Button>
                </CardContent>
            </Card>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>Materiale in Carico sulla Commessa</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Input
                            placeholder="Cerca per nome o codice..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                        <div className="max-h-96 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">Articolo</TableHead>
                                        <TableHead className="text-xs">Rif. Acq.</TableHead>
                                        <TableHead className="text-xs text-right">In Cantiere</TableHead>
                                        <TableHead className="text-xs text-right">Cap. Max</TableHead>
                                        <TableHead className="text-xs text-right">Spazio</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredBatches.map((batch, idx) => {
                                        const currentInWarehouse = (batch.originalQuantity || 0) - (batch.quantity || 0);
                                        const availableSpace = batch.originalQuantity ? Math.max(0, batch.originalQuantity - currentInWarehouse) : 0;

                                        return (
                                            <TableRow key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                                                <TableCell className="py-2">
                                                    <div className="text-sm font-medium">
                                                        {batch.itemName}
                                                        {batch.itemModel && (
                                                            <span className="text-slate-500 dark:text-slate-400 font-normal ml-1">({batch.itemModel})</span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{batch.itemCode}</div>
                                                </TableCell>
                                                <TableCell className="py-2 text-xs text-slate-500 dark:text-slate-400">
                                                    <div>{batch.purchaseRef || "-"}</div>
                                                    {batch.purchaseDate && (
                                                        <div className="text-[10px] text-slate-400">
                                                            ({new Date(batch.purchaseDate).toLocaleDateString('it-IT')})
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-2 text-xs text-right">
                                                    <div className="font-bold">{batch.quantity} {batch.itemUnit}</div>
                                                    {batch.pieces !== null && batch.pieces !== undefined && (
                                                        <div className="text-[10px] text-slate-400">{batch.pieces} pz</div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-2 text-xs text-right text-blue-600 dark:text-blue-400">
                                                    <div className="font-medium">{batch.originalQuantity || '-'} {batch.itemUnit}</div>
                                                    {batch.originalPieces !== null && batch.originalPieces !== undefined && (
                                                        <div className="text-[10px] text-blue-400">{batch.originalPieces} pz</div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-2 text-xs text-right">
                                                    <div className={`font-medium ${availableSpace > 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                        {availableSpace > 0 ? `↓ ${availableSpace.toFixed(2)}` : 'Pieno'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <Button size="sm" variant="secondary" className="h-6 text-xs" onClick={() => handleSelect(batch)}>
                                                        Seleziona
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                            {filteredBatches.length === 0 && (
                                <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
                                    Nessun articolo trovato
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
