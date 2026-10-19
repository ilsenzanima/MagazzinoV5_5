"use client"

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PackQuantityFieldsProps {
    packQuantity: number;            // quantità per confezione, nell'unità dell'articolo
    coefficient: number;             // unità per pezzo
    unit: string;
    quantity: number;                // quantità attuale (solo per il riepilogo)
    onQuantityChange: (quantity: string) => void;
    autoFocus?: boolean;
    resetSignal?: number;            // cambia quando i due campi vanno svuotati (es. quantità scritta a mano)
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Due campi: confezioni intere e pezzi in più (o in meno, con il segno meno).
// «2 scatole + 3 pezzi» = 2 e 3; «3 scatole meno 1 pezzo» = 3 e -1.
export function PackQuantityFields({ packQuantity, coefficient, unit, quantity, onQuantityChange, autoFocus, resetSignal }: PackQuantityFieldsProps) {
    const [packsInput, setPacksInput] = useState("");
    const [extraInput, setExtraInput] = useState("");

    const firstRender = useRef(true);
    useEffect(() => {
        if (firstRender.current) { firstRender.current = false; return; }
        setPacksInput("");
        setExtraInput("");
    }, [resetSignal]);

    const apply = (packsText: string, extraText: string) => {
        setPacksInput(packsText);
        setExtraInput(extraText);
        const packs = parseFloat(packsText.replace(",", "."));
        const extra = parseFloat(extraText.replace(",", "."));
        if (isNaN(packs) && isNaN(extra)) { onQuantityChange(""); return; }
        const total = (isNaN(packs) ? 0 : packs) * packQuantity + (isNaN(extra) ? 0 : extra) * coefficient;
        onQuantityChange(total > 0 ? String(round2(total)) : "");
    };

    const packs = parseFloat(packsInput.replace(",", "."));
    const extra = parseFloat(extraInput.replace(",", "."));
    const breakdown = packsInput !== "" || extraInput !== ""
        ? `${isNaN(packs) ? 0 : packs} conf × ${packQuantity} ${unit}${isNaN(extra) || extra === 0 ? "" : ` ${extra < 0 ? "−" : "+"} ${Math.abs(extra)} pz × ${coefficient} ${unit}`}`
        : "";

    return (
        <div className="space-y-1 rounded-md border border-dashed p-3">
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                    <Label htmlFor="pq-packs">Confezioni</Label>
                    <Input id="pq-packs" type="number" inputMode="decimal" min="0" step="1" autoFocus={autoFocus}
                        value={packsInput} onChange={e => apply(e.target.value, extraInput)} placeholder="0" />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="pq-extra">Pezzi in più o in meno</Label>
                    <Input id="pq-extra" type="number" inputMode="decimal" step="1"
                        value={extraInput} onChange={e => apply(packsInput, e.target.value)} placeholder="es. 3 oppure -1" />
                </div>
            </div>
            <p className="text-[11px] text-slate-500">
                1 confezione = {packQuantity} {unit}{coefficient !== 1 ? `; 1 pezzo = ${coefficient} ${unit}` : ""}.
                Per «2 scatole + 3 pezzi» scrivi 2 e 3; per «3 scatole meno 1 pezzo» scrivi 3 e -1.
            </p>
            {breakdown && (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                    {breakdown} → <span className="font-medium">{quantity > 0 ? `${quantity} ${unit}` : "—"}</span>
                </p>
            )}
        </div>
    );
}
