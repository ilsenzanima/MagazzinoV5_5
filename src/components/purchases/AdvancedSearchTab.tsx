"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { suppliersApi, Supplier } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Loader2, Search, Package } from "lucide-react";

interface PurchaseWithItems {
    id: string;
    deliveryNoteNumber: string;
    deliveryNoteDate: string;
    items: { name: string; model?: string }[];
}

interface ScoredPurchase extends PurchaseWithItems {
    matchCount: number;
    matchedTerms: Set<string>;
    matchedItems: string[];
}

interface InventorySuggestion {
    name: string;
    model?: string;
    label: string; // "name (model)" or just "name"
}

function scoreAndSort(purchases: PurchaseWithItems[], terms: string[]): ScoredPurchase[] {
    const activeTerms = terms.filter(t => t.trim().length > 0);

    return purchases
        .map(p => {
            const matchedTerms = new Set<string>();
            const matchedItems: string[] = [];

            for (const item of p.items) {
                const fullName = [item.name, item.model].filter(Boolean).join(" ").toLowerCase();
                for (const term of activeTerms) {
                    const t = term.trim().toLowerCase();
                    if (t && fullName.includes(t)) {
                        matchedTerms.add(term);
                        if (!matchedItems.includes(item.name)) {
                            matchedItems.push(item.name);
                        }
                    }
                }
            }

            return {
                ...p,
                matchCount: matchedTerms.size,
                matchedTerms,
                matchedItems,
            };
        })
        .filter(p => activeTerms.length === 0 || p.matchCount > 0)
        .sort((a, b) => b.matchCount - a.matchCount);
}

// ── Autocomplete input ──────────────────────────────────────────────────────

interface AutocompleteInputProps {
    value: string;
    onChange: (v: string) => void;
    onRemove: () => void;
    showRemove: boolean;
    suggestions: InventorySuggestion[];
    disabled: boolean;
    placeholder: string;
}

function AutocompleteInput({ value, onChange, onRemove, showRemove, suggestions, disabled, placeholder }: AutocompleteInputProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const filtered = useMemo(() => {
        const q = value.trim().toLowerCase();
        if (!q) return suggestions.slice(0, 12);
        return suggestions
            .filter(s => s.label.toLowerCase().includes(q))
            .slice(0, 12);
    }, [suggestions, value]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const select = (s: InventorySuggestion) => {
        onChange(s.name);
        setOpen(false);
    };

    return (
        <div ref={containerRef} className="relative flex-1">
            <Input
                value={value}
                onChange={e => { onChange(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}
                placeholder={placeholder}
                className="h-8 text-sm pr-7"
                disabled={disabled}
                autoComplete="off"
            />
            {value && !disabled && (
                <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                    onMouseDown={e => { e.preventDefault(); onChange(""); }}
                >
                    <X className="h-3 w-3" />
                </button>
            )}
            {open && !disabled && filtered.length > 0 && (
                <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md shadow-lg max-h-52 overflow-y-auto text-sm">
                    {filtered.map((s, i) => (
                        <li
                            key={i}
                            className="px-3 py-1.5 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-baseline gap-1.5"
                            onMouseDown={e => { e.preventDefault(); select(s); }}
                        >
                            <span className="font-medium text-slate-800 dark:text-slate-100">{s.name}</span>
                            {s.model && <span className="text-xs text-slate-400">({s.model})</span>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// ── Main component ──────────────────────────────────────────────────────────

export function AdvancedSearchTab() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [supplierId, setSupplierId] = useState("");
    const [terms, setTerms] = useState<string[]>([""]);
    const [purchases, setPurchases] = useState<PurchaseWithItems[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        suppliersApi.getAll().then(setSuppliers).catch(console.error);
    }, []);

    useEffect(() => {
        if (!supplierId) { setPurchases([]); return; }
        setLoading(true);
        supabase
            .from("purchases")
            .select("id, delivery_note_number, delivery_note_date, purchase_items(inventory(name, model))")
            .eq("supplier_id", supplierId)
            .eq("order_type", "purchase")
            .order("delivery_note_date", { ascending: false })
            .then(({ data, error }) => {
                if (error) { console.error(error); }
                else {
                    setPurchases((data ?? []).map((p: any) => ({
                        id: p.id,
                        deliveryNoteNumber: p.delivery_note_number,
                        deliveryNoteDate: p.delivery_note_date,
                        items: (p.purchase_items ?? [])
                            .map((i: any) => ({ name: i.inventory?.name ?? "", model: i.inventory?.model }))
                            .filter((i: any) => i.name),
                    })));
                }
                setLoading(false);
            });
    }, [supplierId]);

    // Unique inventory items from all purchases of this supplier
    const suggestions = useMemo<InventorySuggestion[]>(() => {
        const seen = new Set<string>();
        const result: InventorySuggestion[] = [];
        for (const p of purchases) {
            for (const item of p.items) {
                const key = item.model ? `${item.name}||${item.model}` : item.name;
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push({
                        name: item.name,
                        model: item.model,
                        label: item.model ? `${item.name} (${item.model})` : item.name,
                    });
                }
            }
        }
        return result.sort((a, b) => a.label.localeCompare(b.label));
    }, [purchases]);

    const results = useMemo(() => scoreAndSort(purchases, terms), [purchases, terms]);

    const addTerm = () => setTerms(prev => [...prev, ""]);
    const removeTerm = (idx: number) => setTerms(prev => prev.length === 1 ? [""] : prev.filter((_, i) => i !== idx));
    const updateTerm = (idx: number, value: string) => setTerms(prev => prev.map((t, i) => i === idx ? value : t));

    const activeTerms = terms.filter(t => t.trim().length > 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 items-start">
            {/* ── Filtri ── */}
            <div className="space-y-5 bg-white dark:bg-card border dark:border-border rounded-lg p-5 shadow-sm sticky top-28">
                <div>
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                        Fornitore <span className="text-red-500">*</span>
                    </label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleziona fornitore…" />
                        </SelectTrigger>
                        <SelectContent>
                            {suppliers.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                        Articoli
                        {suggestions.length > 0 && (
                            <span className="ml-1.5 text-xs font-normal text-slate-400">({suggestions.length} disponibili)</span>
                        )}
                    </label>
                    <div className="space-y-2">
                        {terms.map((term, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                                <AutocompleteInput
                                    value={term}
                                    onChange={v => updateTerm(idx, v)}
                                    onRemove={() => removeTerm(idx)}
                                    showRemove={terms.length > 1 || !!term}
                                    suggestions={suggestions}
                                    disabled={!supplierId}
                                    placeholder={suggestions.length > 0 ? "Digita o scegli dall'elenco…" : `Es. "tubo", "vite M6"…`}
                                />
                                {(terms.length > 1 || term) && (
                                    <button
                                        onClick={() => removeTerm(idx)}
                                        className="text-slate-400 hover:text-red-500 shrink-0"
                                        title="Rimuovi"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-1 h-8 text-xs border-dashed"
                            onClick={addTerm}
                            disabled={!supplierId}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Aggiungi articolo
                        </Button>
                    </div>
                </div>

                {supplierId && activeTerms.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                        {activeTerms.map((t, i) => (
                            <Badge key={i} variant="secondary" className="text-xs gap-1">
                                <Search className="h-3 w-3" />{t}
                            </Badge>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Risultati ── */}
            <div>
                {!supplierId ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                        <Package className="h-12 w-12 mb-3 opacity-30" />
                        <p className="text-sm">Seleziona un fornitore per iniziare la ricerca</p>
                    </div>
                ) : loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                ) : results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                        <Search className="h-12 w-12 mb-3 opacity-30" />
                        <p className="text-sm">Nessun acquisto trovato per i criteri inseriti</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400 pb-1">
                            {results.length} acquist{results.length === 1 ? "o" : "i"} trovat{results.length === 1 ? "o" : "i"}
                            {activeTerms.length > 0 && ` · ordinati per corrispondenze`}
                        </p>

                        {results.map(p => (
                            <div
                                key={p.id}
                                className="bg-white dark:bg-card border dark:border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div>
                                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                                            Bolla: {p.deliveryNoteNumber}
                                        </span>
                                        <span className="ml-2 text-xs text-slate-400">
                                            {new Date(p.deliveryNoteDate).toLocaleDateString("it-IT")}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {activeTerms.length > 0 && (
                                            <Badge
                                                variant={p.matchCount === activeTerms.length ? "default" : "secondary"}
                                                className="text-xs"
                                            >
                                                {p.matchCount}/{activeTerms.length} match
                                            </Badge>
                                        )}
                                        <Link
                                            href={`/purchases/${p.id}`}
                                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                                        >
                                            Apri
                                        </Link>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {p.items.map((item, i) => {
                                        const fullName = [item.name, item.model].filter(Boolean).join(" ").toLowerCase();
                                        const isMatch = activeTerms.some(t => fullName.includes(t.trim().toLowerCase()));
                                        return (
                                            <span
                                                key={i}
                                                className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${
                                                    isMatch
                                                        ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-medium"
                                                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                                                }`}
                                            >
                                                {item.name}{item.model ? ` (${item.model})` : ""}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
