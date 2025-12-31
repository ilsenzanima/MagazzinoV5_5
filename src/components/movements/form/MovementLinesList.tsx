import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { MovementLine } from "@/hooks/useMovementForm";

interface MovementLinesListProps {
    lines: MovementLine[];
    onRemove: (tempId: string) => void;
}

export function MovementLinesList({ lines, onRemove }: MovementLinesListProps) {
    return (
        <div className="bg-white dark:bg-card rounded-lg border dark:border-border shadow-sm overflow-hidden overflow-x-auto">
            <Table>
                <TableHeader className="bg-slate-50 dark:bg-muted">
                    <TableRow>
                        <TableHead>Codice</TableHead>
                        <TableHead>Descrizione</TableHead>
                        <TableHead className="text-right">Pezzi</TableHead>
                        <TableHead className="text-right">Q.tà</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lines.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-slate-400 dark:text-slate-500">
                                Nessuna riga inserita
                            </TableCell>
                        </TableRow>
                    ) : (
                        lines.map(line => (
                            <TableRow key={line.tempId}>
                                <TableCell className="font-medium text-xs">{line.itemCode}</TableCell>
                                <TableCell>
                                    <div className="text-sm font-medium truncate max-w-[200px]">{line.itemName}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{line.itemDescription}</div>
                                    {line.purchaseRef && (
                                        <Badge variant="outline" className="text-[10px] mt-1">
                                            Lotto: {line.purchaseRef}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    {line.pieces || "-"}
                                </TableCell>
                                <TableCell className="text-right font-bold">
                                    {line.quantity} {line.itemUnit}
                                </TableCell>
                                <TableCell>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-red-500"
                                        onClick={() => onRemove(line.tempId)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
