"use client";

import { Supplier } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface SupplierDeleteDialogProps {
    supplier: Supplier | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}

export function SupplierDeleteDialog({
    supplier,
    open,
    onOpenChange,
    onConfirm
}: SupplierDeleteDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Elimina Fornitore</DialogTitle>
                    <DialogDescription>
                        Sei sicuro di voler eliminare il fornitore <strong>{supplier?.name}</strong>?
                        <br />
                        Se ci sono acquisti collegati, l'operazione verrà bloccata.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
                    <Button variant="destructive" onClick={onConfirm}>Elimina</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
