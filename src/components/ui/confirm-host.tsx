"use client";

import { useEffect, useState } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Request { message: string; resolve: (ok: boolean) => void }

let push: ((r: Request) => void) | null = null;

// Al posto di window.confirm: apre il nostro dialogo e risponde true/false.
// Uso: if (!await confirmDialog("Eliminare questo elemento?")) return;
export function confirmDialog(message: string): Promise<boolean> {
    return new Promise(resolve => {
        if (!push) { resolve(window.confirm(message)); return; }
        push({ message, resolve });
    });
}

const DANGER = /elimin|rimuov|rimozion|resett|annull/i;

export function ConfirmHost() {
    const [current, setCurrent] = useState<Request | null>(null);

    useEffect(() => {
        push = (r) => setCurrent(prev => { prev?.resolve(false); return r; });
        return () => { push = null; };
    }, []);

    const close = (ok: boolean) => {
        current?.resolve(ok);
        setCurrent(null);
    };

    const danger = current ? DANGER.test(current.message) : false;
    const confirmLabel = !current ? "" : /elimin/i.test(current.message) ? "Elimina" : /rimuov|rimozion/i.test(current.message) ? "Rimuovi" : "Conferma";

    return (
        <AlertDialog open={!!current} onOpenChange={(open) => { if (!open) close(false); }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{danger ? "Conferma" : "Conferma operazione"}</AlertDialogTitle>
                    <AlertDialogDescription className="whitespace-pre-line">{current?.message}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => close(true)}
                        className={danger ? "bg-red-600 hover:bg-red-700 focus:ring-red-600" : undefined}
                    >
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
