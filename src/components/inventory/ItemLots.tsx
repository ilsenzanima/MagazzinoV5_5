import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Package, ExternalLink } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { reassignLotToEntries } from "@/app/inventory/[id]/actions";
import Link from "next/link";
import { notify } from "@/lib/notify";

interface LotInfo {
    id: string;
    purchaseId?: string;
    purchaseRef: string;
    date: string;
    originalQty: number;
    remainingQty: number;
    originalPieces?: number;
    remainingPieces?: number;
    price?: number;
}

interface ItemLotsProps {
    itemId: string;
    itemUnit: string;
    lots: LotInfo[];
    untrackedQuantity: number;
    untrackedPieces?: number;
    onReassignComplete: () => void;
}

export function ItemLots({ itemId, itemUnit, lots, untrackedQuantity, untrackedPieces, onReassignComplete }: ItemLotsProps) {
    const [isReassignOpen, setIsReassignOpen] = useState(false);
    const [selectedLot, setSelectedLot] = useState("");
    const [quantityToAssign, setQuantityToAssign] = useState(untrackedQuantity.toString());
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleReassign = async () => {
        if (!selectedLot || !quantityToAssign) return;

        setIsSubmitting(true);
        try {
            const result = await reassignLotToEntries(itemId, selectedLot, parseFloat(quantityToAssign));

            if (result.success) {
                notify.success(`✓ ${result.message}`);
                setIsReassignOpen(false);
                setSelectedLot("");
                setQuantityToAssign("");
                onReassignComplete();
            } else {
                notify.error(`✗ Errore: ${result.error}`);
            }
        } catch (error: any) {
            notify.error(`✗ Errore: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Untracked Inventory Warning */}
            {untrackedQuantity > 0.001 && (
                <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Materiale Non Tracciato
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                                    {untrackedQuantity.toFixed(2)} {itemUnit}
                                </div>
                                {untrackedPieces !== undefined && untrackedPieces > 0 && (
                                    <div className="text-sm text-red-600 dark:text-red-400">
                                        {untrackedPieces} pezzi
                                    </div>
                                )}
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                    Questo materiale è in magazzino ma non è assegnato a nessun lotto di acquisto
                                </p>
                            </div>
                            <Dialog open={isReassignOpen} onOpenChange={setIsReassignOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                        Riassegna a Lotto
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Riassegna Materiale a Lotto</DialogTitle>
                                        <DialogDescription>
                                            Seleziona il lotto a cui assegnare il materiale non tracciato
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Quantità da Assegnare</Label>
                                            <Input
                                                type="number"
                                                value={quantityToAssign}
                                                onChange={(e) => setQuantityToAssign(e.target.value)}
                                                placeholder="Quantità"
                                            />
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                Disponibile: {untrackedQuantity.toFixed(2)} {itemUnit}
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Lotto di Destinazione</Label>
                                            <Select value={selectedLot} onValueChange={setSelectedLot}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleziona lotto..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {lots.map(lot => {
                                                        const availableSpace = lot.originalQty - lot.remainingQty;
                                                        return (
                                                            <SelectItem key={lot.id} value={lot.id} disabled={availableSpace <= 0}>
                                                                {lot.purchaseRef} - Spazio: {availableSpace.toFixed(2)} {itemUnit}
                                                                {availableSpace <= 0 && " (Pieno)"}
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsReassignOpen(false)}>
                                            Annulla
                                        </Button>
                                        <Button onClick={handleReassign} disabled={!selectedLot || isSubmitting}>
                                            {isSubmitting ? "Assegnazione..." : "Assegna"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Lots List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Storico Lotti</CardTitle>
                </CardHeader>
                <CardContent>
                    {lots.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                            <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p>Nessun lotto trovato</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Rif. Acquisto</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead className="text-right">Prezzo Unit.</TableHead>
                                    <TableHead className="text-right">Disponibile</TableHead>
                                    <TableHead className="text-right">Usato %</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lots.map(lot => {
                                    const usedPercentage = ((lot.originalQty - lot.remainingQty) / lot.originalQty * 100);
                                    const rowContent = (
                                        <>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    {lot.purchaseRef}
                                                    {lot.purchaseId && (
                                                        <ExternalLink className="h-3 w-3 text-blue-500" />
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-500 dark:text-slate-400">
                                                {format(new Date(lot.date), 'dd/MM/yyyy')}
                                            </TableCell>
                                            <TableCell className="text-right text-sm">
                                                {lot.price !== undefined && lot.price !== null ? (
                                                    <span className="font-medium">€ {lot.price.toFixed(2)}</span>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">N/D</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="font-bold">{lot.remainingQty.toFixed(2)} {itemUnit}</div>
                                                {lot.remainingPieces !== undefined && (
                                                    <div className="text-xs text-slate-400">{lot.remainingPieces} pz</div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant={usedPercentage >= 90 ? "destructive" : usedPercentage >= 50 ? "secondary" : "default"}>
                                                    {usedPercentage.toFixed(0)}%
                                                </Badge>
                                            </TableCell>
                                        </>
                                    );

                                    return lot.purchaseId ? (
                                        <TableRow
                                            key={lot.id}
                                            className={`cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${lot.remainingQty <= 0.001 ? 'opacity-50' : ''}`}
                                            onClick={() => window.location.href = `/purchases/${lot.purchaseId}`}
                                        >
                                            {rowContent}
                                        </TableRow>
                                    ) : (
                                        <TableRow key={lot.id}>
                                            {rowContent}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
