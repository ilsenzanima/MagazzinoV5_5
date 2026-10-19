"use client"

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { clientsApi } from "@/lib/api";
import type { ClientDuplicate } from "@/lib/services/clients";

const REASONS: Record<ClientDuplicate["reason"], string> = {
    "stessa-partita-iva": "stessa partita IVA",
    "stesso-nome": "stesso nome",
    "stesso-indirizzo": "stesso indirizzo",
    "nome-simile": "nome simile",
};

interface DuplicateClientsNoticeProps {
    name: string;
    vatNumber: string;
    street?: string;
    streetNumber?: string;
    postalCode?: string;
    city?: string;
}

// Avviso (non bloccante) se esiste già un committente con la stessa partita IVA o un nome uguale/simile
export function DuplicateClientsNotice({ name, vatNumber, street = "", streetNumber = "", postalCode = "", city = "" }: DuplicateClientsNoticeProps) {
    const [duplicates, setDuplicates] = useState<ClientDuplicate[]>([]);

    useEffect(() => {
        const hasAddress = street.trim().length >= 4 && /\d/.test(streetNumber);
        if (name.trim().length < 3 && vatNumber.replace(/\D/g, "").length < 8 && !hasAddress) { setDuplicates([]); return; }
        let cancelled = false;
        const timer = setTimeout(() => {
            clientsApi.findDuplicates(name, vatNumber, { street, streetNumber, postalCode, city })
                .then(list => { if (!cancelled) setDuplicates(list); })
                .catch(() => { /* non bloccante */ });
        }, 400);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [name, vatNumber, street, streetNumber, postalCode, city]);

    if (duplicates.length === 0) return null;

    return (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/30">
            <p className="font-medium text-amber-900 dark:text-amber-200">
                {duplicates.length === 1 ? "Esiste già un committente simile" : "Esistono già committenti simili"}
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300">
                Se è lo stesso, conviene usare quello già creato per non dividere commesse e offerte tra due schede.
            </p>
            <ul className="space-y-1">
                {duplicates.map(d => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white/70 p-2 dark:bg-slate-900/40">
                        <span>
                            <span className="font-medium">{d.name}</span>
                            <span className="text-xs text-slate-500">
                                {d.vatNumber ? ` · P.IVA ${d.vatNumber}` : ""}{d.address ? ` · ${d.address}` : d.city ? ` · ${d.city}` : ""} · {REASONS[d.reason]}
                            </span>
                        </span>
                        <Button asChild variant="outline" size="sm">
                            <a href={`/clients/${d.id}`} target="_blank" rel="noopener noreferrer">Apri committente</a>
                        </Button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
