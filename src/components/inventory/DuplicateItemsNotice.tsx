"use client"

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { inventoryApi } from "@/lib/api";
import type { DuplicateCandidate } from "@/lib/services/inventory";

interface DuplicateItemsNoticeProps {
    name: string;
    model: string;
    excludeId?: string;   // articolo che si sta modificando: non va confrontato con sé stesso
    onUse?: (id: string) => void;   // se presente il pulsante diventa «Usa questo articolo»
}

// Avviso (non bloccante) se esiste già un articolo con lo stesso nome e la stessa variante
export function DuplicateItemsNotice({ name, model, excludeId, onUse }: DuplicateItemsNoticeProps) {
    const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);

    useEffect(() => {
        if (name.trim().length < 2 || !model.trim()) { setDuplicates([]); return; }
        let cancelled = false;
        const timer = setTimeout(() => {
            inventoryApi.findDuplicates(name, model, excludeId)
                .then(list => { if (!cancelled) setDuplicates(list); })
                .catch(() => { /* non bloccante */ });
        }, 400);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [name, model, excludeId]);

    if (duplicates.length === 0) return null;

    return (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/30">
            <p className="font-medium text-amber-900 dark:text-amber-200">
                {duplicates.length === 1 ? "Esiste già un articolo uguale" : "Esistono già articoli uguali"}
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300">
                Stesso nome e stessa variante: di solito conviene usare quello già creato. Se è un articolo diverso
                (per esempio un&apos;altra marca) puoi proseguire.
            </p>
            <ul className="space-y-1">
                {duplicates.map(d => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white/70 p-2 dark:bg-slate-900/40">
                        <span>
                            <span className="font-mono text-xs">{d.code}</span> — {d.name}{d.model ? ` — ${d.model}` : ""}
                            <span className="text-xs text-slate-500">{d.brand ? ` · ${d.brand}` : ""} · giacenza {d.quantity}</span>
                        </span>
                        {onUse ? (
                            <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => onUse(d.id)}>
                                Usa questo articolo
                            </Button>
                        ) : (
                            <Button asChild variant="outline" size="sm">
                                <a href={`/inventory/${d.id}`} target="_blank" rel="noopener noreferrer">Apri questo articolo</a>
                            </Button>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
