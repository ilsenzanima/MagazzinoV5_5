import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface MovementJobInventoryProps {
    jobBatchAvailability: any[];
    onSelectBatch: (batch: any) => void;
}

export function MovementJobInventory({ jobBatchAvailability, onSelectBatch }: MovementJobInventoryProps) {
    if (jobBatchAvailability.length === 0) return null;

    return (
        <Card className="bg-slate-50 dark:bg-muted border-blue-100 dark:border-blue-900">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-300">Materiale in Carico sulla Commessa</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="max-h-60 overflow-y-auto overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs">Articolo</TableHead>
                                <TableHead className="text-xs">Rif. Acq.</TableHead>
                                <TableHead className="text-xs text-right">Q.tà</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {jobBatchAvailability.map((batch, idx) => (
                                <TableRow key={idx} className="hover:bg-white dark:hover:bg-card">
                                    <TableCell className="py-2">
                                        <div className="text-xs font-medium">{batch.itemCode}</div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]">{batch.itemName}</div>
                                    </TableCell>
                                    <TableCell className="py-2 text-xs text-slate-500 dark:text-slate-400">
                                        {batch.purchaseRef || "-"}
                                    </TableCell>
                                    <TableCell className="py-2 text-xs text-right font-bold">
                                        {batch.quantity} {batch.itemUnit}
                                    </TableCell>
                                    <TableCell className="py-2">
                                        <Button size="sm" variant="secondary" className="h-6 text-xs" onClick={() => onSelectBatch(batch)}>
                                            Seleziona
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
