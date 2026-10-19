"use client"

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { suppliersApi } from "@/lib/api";
import type { SupplierDuplicate } from "@/lib/services/suppliers";

const REASONS: Record<SupplierDuplicate["reason"], string> = {
    "stessa-partita-iva": "stessa partita IVA",
    "stesso-nome": "stesso nome",
    "stesso-indirizzo": "stesso indirizzo",
    "nome-simile": "nome simile",
};

interface DuplicateSuppliersNoticeProps {
    name: string;
    vatNumber: string;
    address: string;
}

// Avviso (non bloccante) se esiste già un fornitore con la stessa partita IVA, un nome uguale/simile o lo stesso indirizzo
export function DuplicateSuppliersNotice({ name, vatNumber, address }: DuplicateSuppliersNoticeProps) {
    const [duplicates, setDuplicates] = useState<SupplierDuplicate[]>([]);

    useEffect(() => {
        if (name.trim().length < 3 && vatNumber.replace(/\D/g, "").length < 8 && address.trim().length < 8) { setDuplicates([]); return; }
        let cancelled = false;
        const timer = setTimeout(() => {
            suppliersApi.findDuplicates(name, vatNumber, address)
                .then(list => { if (!cancelled) setDuplicates(list); })
                .catch(() => { /* non bloccante */ });
        }, 400);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [name, vatNumber, address]);

    if (duplicates.length === 0) return null;

    return (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/30">
            <p className="font-medium text-amber-900 dark:text-amber-200">
                {duplicates.length === 1 ? "Esiste già un fornitore simile" : "Esistono già fornitori simili"}
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300">
                Se è lo stesso, conviene usare quello già creato per non dividere acquisti e fatture tra due schede.
            </p>
            <ul className="space-y-1">
                {duplicates.map(d => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white/70 p-2 dark:bg-slate-900/40">
                        <span>
                            <span className="font-medium">{d.name}</span>
                            <span className="text-xs text-slate-500">
                                {d.vatNumber ? ` · P.IVA ${d.vatNumber}` : ""}{d.address ? ` · ${d.address}` : ""} · {REASONS[d.reason]}
                            </span>
                        </span>
                        <Button asChild variant="outline" size="sm">
                            <a href={`/suppliers/${d.id}`} target="_blank" rel="noopener noreferrer">Apri fornitore</a>
                        </Button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
