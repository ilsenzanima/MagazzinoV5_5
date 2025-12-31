"use client";

import { Client } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface ClientDeleteDialogProps {
    client: Client | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}

export function ClientDeleteDialog({
    client,
    open,
    onOpenChange,
    onConfirm
}: ClientDeleteDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Elimina Committente</DialogTitle>
                    <DialogDescription>
                        Sei sicuro di voler eliminare il committente <strong>{client?.name}</strong>?
                        <br />
                        Questa azione eliminerà anche tutte le commesse associate.
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
