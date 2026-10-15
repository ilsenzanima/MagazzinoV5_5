"use client"

import dynamic from "next/dynamic";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Pencil, Plus, Search, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notify } from "@/lib/notify";
import { brandsApi, itemTypesApi, unitsApi, inventoryApi, Brand, ItemType, Unit } from "@/lib/api";
import type { InventoryItem } from "@/lib/types";
import {
    VariantField, VariantTemplate, VariantValues,
    cleanValues, composeVariant, defaultValues, isFieldVisible, missingRequiredFields, packQuantityFrom,
} from "@/lib/utils/variant-template";

const ImageCropper = dynamic(
    () => import("@/components/ui/image-cropper").then((m) => ({ default: m.ImageCropper })),
    { ssr: false, loading: () => null }
);

// Dati raccolti dalla procedura guidata: alimentano i campi della scheda sotto il modale
export interface WizardDraft {
    baseItemId: string | null;     // articolo da cui si copia (variante)
    baseModel: string;             // modello dell'originale: la variante deve essere diversa
    name: string;
    model: string;
    variantAttributes: VariantValues; // valori della scheda della tipologia (se presente)
    customModel: boolean;          // variante scritta a mano invece che dalla scheda
    description: string;
    wantsImage: boolean;
    imageFile: File | null;
    imageUrl: string;              // foto già esistente (copiata dall'originale)
    hasSupplierCode: boolean;
    supplierCode: string;
    brand: string;
    type: string;
    unit: string;
    wantsMinStock: boolean;
    minStock: string;
    coefficient: string;
    packQuantity: string;
}

export const EMPTY_DRAFT: WizardDraft = {
    baseItemId: null, baseModel: "",
    name: "", model: "", variantAttributes: {}, customModel: false, description: "",
    wantsImage: false, imageFile: null, imageUrl: "",
    hasSupplierCode: false, supplierCode: "",
    brand: "", type: "", unit: "PZ",
    wantsMinStock: false, minStock: "0",
    coefficient: "1", packQuantity: "",
};

// Bozza a partire da un articolo esistente (stessi dati di «Crea variante» + quantità per confezione)
export const draftFromItem = (item: InventoryItem): WizardDraft => ({
    ...EMPTY_DRAFT,
    baseItemId: item.id,
    baseModel: item.model || "",
    name: item.name,
    model: "",                                   // la variante va indicata per distinguerla
    variantAttributes: {},                       // i valori della scheda vanno indicati di nuovo
    description: item.description || "",
    imageUrl: item.image || "",
    hasSupplierCode: !!item.supplierCode,
    supplierCode: item.supplierCode || "",
    brand: item.brand || "",
    type: item.type || "",
    unit: item.unit || "PZ",
    coefficient: item.coefficient != null ? String(item.coefficient) : "1",
    packQuantity: item.packQuantity != null ? String(item.packQuantity) : "",
});

const STEPS = ["Tipo di articolo", "Informazioni", "Marca e scorte", "Unità e confezione"];

// Permette alla pagina di riallineare la procedura guidata ai valori attuali della scheda
export interface NewItemWizardHandle {
    syncFrom: (values: {
        name: string; model: string; description: string; brand: string; type: string; unit: string;
        supplierCode: string; minStock: string; coefficient: string; packQuantity: string; image: string;
    }, imageFile: File | null) => void;
}

interface NewItemWizardProps {
    open: boolean;
    onClose: () => void;                              // chiude il modale e si continua a mano
    initialDraft?: WizardDraft;                       // es. variante da «Crea variante»
    startStep?: number;
    onChange: (draft: WizardDraft) => void;           // la scheda sotto si riempie man mano
    onCreate: (draft: WizardDraft) => Promise<boolean>;
}

// Campo della scheda della tipologia
function TemplateFieldInput({ field, value, onChange, suggestions }: {
    field: VariantField;
    value: string;
    onChange: (v: string) => void;
    suggestions: string[];
}) {
    const listId = `dl-${field.key}`;
    return (
        <div className="space-y-1">
            <Label className="text-xs">
                {field.label}{field.required ? " *" : ""}
            </Label>
            <div className="flex items-center gap-2">
                {field.kind === "choice" && !field.open ? (
                    <Select value={value} onValueChange={onChange}>
                        <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                        <SelectContent>
                            {(field.options ?? []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                    </Select>
                ) : (
                    <>
                        <Input
                            type={field.kind === "number" ? "number" : "text"}
                            step={field.kind === "number" ? "any" : undefined}
                            min={field.kind === "number" ? "0" : undefined}
                            value={value}
                            list={field.kind === "choice" ? listId : undefined}
                            placeholder={field.kind === "choice" ? "Scegli o scrivi..." : undefined}
                            onChange={e => onChange(e.target.value)}
                        />
                        {field.kind === "choice" && (
                            <datalist id={listId}>
                                {suggestions.map(o => <option key={o} value={o} />)}
                            </datalist>
                        )}
                    </>
                )}
                {field.unit && <span className="text-sm text-slate-500">{field.unit}</span>}
            </div>
            {field.hint && <p className="text-[11px] text-slate-500">{field.hint}</p>}
        </div>
    );
}

export const NewItemWizard = forwardRef<NewItemWizardHandle, NewItemWizardProps>(function NewItemWizard(
    { open, onClose, initialDraft, startStep = 0, onChange, onCreate },
    ref
) {
    const [step, setStep] = useState(startStep);
    const [draft, setDraft] = useState<WizardDraft>(initialDraft ?? EMPTY_DRAFT);
    const [choice, setChoice] = useState<"new" | "copy" | null>(initialDraft?.baseItemId ? "copy" : null);
    const [creating, setCreating] = useState(false);

    // Dati di riferimento
    const [brands, setBrands] = useState<Brand[]>([]);
    const [types, setTypes] = useState<ItemType[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);

    // Ricerca articolo da copiare
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<InventoryItem[]>([]);
    const [searching, setSearching] = useState(false);
    const [loadingBase, setLoadingBase] = useState(false);
    const [baseLabel, setBaseLabel] = useState(initialDraft?.baseItemId ? initialDraft.name : "");

    // Marca
    const [brandQuery, setBrandQuery] = useState(initialDraft?.brand ?? "");
    const [addingBrand, setAddingBrand] = useState(false);

    // Foto
    const [cropOpen, setCropOpen] = useState(false);
    const [cropSrc, setCropSrc] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState("");

    const patch = (p: Partial<WizardDraft>) => setDraft(prev => ({ ...prev, ...p }));

    // Alla riapertura i dati della scheda (anche modificati a mano) tornano nella procedura guidata
    useImperativeHandle(ref, () => ({
        syncFrom: (v, file) => {
            const minStockNumber = parseFloat((v.minStock || "0").replace(",", "."));
            setDraft(prev => ({
                ...prev,
                name: v.name,
                model: v.model,
                // se la variante è stata scritta a mano non corrisponde più ai campi della scheda
                customModel: prev.customModel || v.model !== prev.model,
                description: v.description,
                brand: v.brand,
                type: v.type,
                unit: v.unit || prev.unit,
                hasSupplierCode: !!v.supplierCode,
                supplierCode: v.supplierCode,
                wantsMinStock: minStockNumber > 0,
                minStock: minStockNumber > 0 ? v.minStock : "0",
                coefficient: v.coefficient,
                packQuantity: v.packQuantity,
                imageUrl: v.image || prev.imageUrl,
                imageFile: file ?? prev.imageFile,
                wantsImage: prev.wantsImage || !!file,
            }));
            setBrandQuery(v.brand);
        },
    }));

    // La scheda sotto il modale si aggiorna a ogni modifica
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => {
        Promise.all([brandsApi.getAll(), itemTypesApi.getAll(), unitsApi.getAll()])
            .then(([b, t, u]) => { setBrands(b); setTypes(t); setUnits(u); })
            .catch(() => notify.error("Errore nel caricamento di marche, tipologie e unità"));
    }, []);

    // Scheda della tipologia scelta (se esiste)
    const template: VariantTemplate | null = useMemo(
        () => types.find(t => t.name === draft.type)?.variantTemplate ?? null,
        [types, draft.type]
    );
    const useMask = !!template && !draft.customModel;

    // Alla scheda sotto vanno solo i valori dei campi visibili e compilati
    useEffect(() => {
        const attrs = draft.customModel ? {} : cleanValues(template, draft.variantAttributes);
        onChangeRef.current({ ...draft, variantAttributes: attrs });
    }, [draft, template]);

    // Valori già usati per la stessa tipologia: arricchiscono le liste aperte
    const [usedValues, setUsedValues] = useState<Record<string, string[]>>({});
    useEffect(() => {
        if (!template || !draft.type) { setUsedValues({}); return; }
        let cancelled = false;
        inventoryApi.getVariantAttributesByType(draft.type)
            .then(rows => {
                if (cancelled) return;
                const map: Record<string, Set<string>> = {};
                for (const attrs of rows) {
                    for (const [k, v] of Object.entries(attrs)) {
                        (map[k] ??= new Set()).add(String(v));
                    }
                }
                setUsedValues(Object.fromEntries(Object.entries(map).map(([k, s]) => [k, Array.from(s).sort()])));
            })
            .catch(() => { /* non bloccante */ });
        return () => { cancelled = true; };
    }, [template, draft.type]);

    // Cambio di una voce della scheda: ricompone la variante e, se previsto, la quantità per confezione
    const setAttribute = (key: string, value: string) => {
        setDraft(prev => {
            const attrs = { ...prev.variantAttributes, [key]: value };
            const next: WizardDraft = { ...prev, variantAttributes: attrs };
            if (template && !prev.customModel) {
                next.model = composeVariant(template, attrs);
                const pack = packQuantityFrom(template, attrs);
                if (pack) next.packQuantity = pack;
            }
            return next;
        });
    };

    // Cambio di tipologia: i valori della scheda precedente non valgono più
    const changeType = (typeName: string) => {
        const newTemplate = types.find(t => t.name === typeName)?.variantTemplate ?? null;
        setDraft(prev => {
            const prevTemplate = types.find(t => t.name === prev.type)?.variantTemplate ?? null;
            const attrs = defaultValues(newTemplate);
            // Con una scheda la variante si ricompone; passando a una tipologia senza scheda si svuota
            // solo se arrivava dalla scheda precedente (una variante scritta a mano resta)
            const model = newTemplate
                ? composeVariant(newTemplate, attrs)
                : prevTemplate && !prev.customModel ? "" : prev.model;
            return { ...prev, type: typeName, variantAttributes: attrs, customModel: false, model };
        });
    };

    // Ricerca articoli simili (con una piccola attesa mentre si scrive)
    useEffect(() => {
        if (choice !== "copy" || draft.baseItemId) return;
        const term = search.trim();
        if (term.length < 2) { setResults([]); return; }
        setSearching(true);
        const timer = setTimeout(async () => {
            try {
                const { items } = await inventoryApi.getPaginated({ page: 1, limit: 12, search: term });
                setResults(items as InventoryItem[]);
            } catch { setResults([]); }
            finally { setSearching(false); }
        }, 300);
        return () => clearTimeout(timer);
    }, [search, choice, draft.baseItemId]);

    const pickBase = async (item: InventoryItem) => {
        setLoadingBase(true);
        try {
            const full = await inventoryApi.getById(item.id);
            if (!full) throw new Error("not found");
            const fresh = draftFromItem(full as InventoryItem);
            const tpl = types.find(t => t.name === fresh.type)?.variantTemplate ?? null;
            // I valori della scheda dell'originale sono un buon punto di partenza: si cambia ciò che distingue la variante
            const attrs = { ...defaultValues(tpl), ...((full as InventoryItem).variantAttributes ?? {}) };
            setDraft(prev => ({ ...fresh, variantAttributes: tpl ? attrs : {}, imageFile: prev.imageFile }));
            setBrandQuery(full.brand || "");
            setBaseLabel([full.name, full.model].filter(Boolean).join(" — "));
            setResults([]);
        } catch {
            notify.error("Impossibile caricare l'articolo selezionato");
        } finally {
            setLoadingBase(false);
        }
    };

    const clearBase = () => {
        setDraft(EMPTY_DRAFT);
        setBrandQuery("");
        setBaseLabel("");
        setSearch("");
    };

    // ── Validazione per pagina ──────────────────────────────────────────────
    const isVariant = !!draft.baseItemId;
    const composed = useMask ? composeVariant(template, draft.variantAttributes) : draft.model;
    const modelSameAsBase = isVariant && composed.trim().toLowerCase() === draft.baseModel.trim().toLowerCase();
    const coefficientNum = parseFloat(draft.coefficient.replace(",", "."));
    const packNum = draft.packQuantity.trim() === "" ? null : parseFloat(draft.packQuantity.replace(",", "."));
    const minStockNum = parseFloat(draft.minStock.replace(",", "."));
    const missingMask = useMask ? missingRequiredFields(template, draft.variantAttributes) : [];

    const stepErrors: string[][] = [
        choice === null ? ["Scegli se l'articolo è nuovo o simile a uno esistente"]
            : choice === "copy" && !draft.baseItemId ? ["Cerca e seleziona l'articolo da copiare"] : [],
        [
            ...(draft.type ? [] : ["Seleziona la tipologia"]),
            ...(draft.name.trim() ? [] : ["Il nome del prodotto è obbligatorio"]),
            ...missingMask.map(f => `Compila "${f.label}"`),
            ...(isVariant && !composed.trim() ? ["Indica la variante / modello per distinguerlo dall'originale"] : []),
            ...(modelSameAsBase ? ["La variante deve essere diversa da quella dell'articolo copiato"] : []),
            ...(draft.hasSupplierCode && !draft.supplierCode.trim() ? ["Inserisci il codice del fornitore o togli la spunta"] : []),
        ],
        [
            ...(draft.brand.trim() ? [] : ["Seleziona o aggiungi una marca"]),
            ...(draft.unit ? [] : ["Seleziona l'unità di misura"]),
            ...(draft.wantsMinStock && !(minStockNum > 0) ? ["Indica la quantità della scorta minima (maggiore di 0)"] : []),
        ],
        [
            ...(coefficientNum > 0 ? [] : ["Il coefficiente deve essere maggiore di 0"]),
            ...(packNum !== null && !(packNum > 0) ? ["La quantità per confezione deve essere maggiore di 0"] : []),
        ],
    ];
    const errors = stepErrors[step] ?? [];
    const canNext = errors.length === 0;

    // ── Marca ───────────────────────────────────────────────────────────────
    const q = brandQuery.trim().toLowerCase();
    const brandMatches = q ? brands.filter(b => b.name.toLowerCase().includes(q)).slice(0, 6) : brands.slice(0, 6);
    const exactBrand = brands.find(b => b.name.toLowerCase() === q);

    const addBrand = async () => {
        const name = brandQuery.trim();
        if (!name) return;
        setAddingBrand(true);
        try {
            const created = await brandsApi.create(name);
            setBrands(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "it")));
            patch({ brand: created.name });
            setBrandQuery(created.name);
            notify.success(`Marca "${created.name}" aggiunta`);
        } catch {
            notify.error("Impossibile aggiungere la marca (esiste già o non hai i permessi)");
        } finally {
            setAddingBrand(false);
        }
    };

    // ── Foto ────────────────────────────────────────────────────────────────
    const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            setCropSrc(reader.result?.toString() || "");
            setCropOpen(true);
            e.target.value = "";
        });
        reader.readAsDataURL(file);
    };

    const onCropped = (file: File) => {
        patch({ imageFile: file });
        setPreviewUrl(URL.createObjectURL(file));
    };

    const create = async () => {
        setCreating(true);
        try {
            await onCreate({
                ...draft,
                model: composed,
                variantAttributes: draft.customModel ? {} : cleanValues(template, draft.variantAttributes),
            });
        } finally {
            setCreating(false);
        }
    };

    const unitLabel = draft.unit || "unità";
    const visibleFields = template ? template.fields.filter(f => isFieldVisible(f, draft.variantAttributes)) : [];

    return (
        <>
            <ImageCropper open={cropOpen} onOpenChange={setCropOpen} imageSrc={cropSrc}
                onCropComplete={onCropped} title="Ritaglia Foto Articolo" />

            <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
                <DialogContent
                    // Il modale si chiude solo con il pulsante dedicato o a operazione conclusa
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                    onPointerDownOutside={(e) => e.preventDefault()}
                    className="flex h-[100dvh] max-w-none flex-col rounded-none sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-lg"
                >
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-2 pr-8">
                            <div>
                                <DialogTitle>Nuovo articolo guidato</DialogTitle>
                                <DialogDescription>
                                    Passo {step + 1} di {STEPS.length}: {STEPS[step]}
                                </DialogDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={onClose} className="shrink-0">
                                <X className="mr-1 h-4 w-4" />
                                Chiudi e continua a mano
                            </Button>
                        </div>
                        <div className="mt-2 flex gap-1">
                            {STEPS.map((_, i) => (
                                <div key={i} className={`h-1.5 flex-1 rounded ${i <= step ? "bg-blue-600" : "bg-slate-200"}`} />
                            ))}
                        </div>
                    </DialogHeader>

                    <div className="flex-1 space-y-4 overflow-y-auto py-2">
                        {/* ── Pagina 1: nuovo o simile ── */}
                        {step === 0 && (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-600">L&apos;articolo è nuovo oppure è simile a uno già presente da cui copiare le informazioni di base?</p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <button type="button"
                                        onClick={() => { setChoice("new"); if (draft.baseItemId) clearBase(); }}
                                        className={`rounded-lg border p-4 text-left transition ${choice === "new" ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                                        <div className="font-medium">Articolo nuovo</div>
                                        <div className="text-xs text-slate-500">Compilo tutte le informazioni.</div>
                                    </button>
                                    <button type="button"
                                        onClick={() => setChoice("copy")}
                                        className={`rounded-lg border p-4 text-left transition ${choice === "copy" ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                                        <div className="font-medium">Simile a uno esistente</div>
                                        <div className="text-xs text-slate-500">Copio marca, tipologia, unità, coefficiente e confezione.</div>
                                    </button>
                                </div>

                                {choice === "copy" && (
                                    <div className="space-y-2">
                                        {draft.baseItemId ? (
                                            <div className="flex items-center justify-between rounded-md border bg-slate-50 p-3 dark:bg-slate-800/40">
                                                <div className="text-sm">
                                                    <span className="text-xs text-slate-500">Copiato da</span>
                                                    <div className="font-medium">{baseLabel || draft.name}</div>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={clearBase}>Cambia</Button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="relative">
                                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                                    <Input autoFocus className="pl-8" placeholder="Cerca per nome, modello, marca o codice..."
                                                        value={search} onChange={e => setSearch(e.target.value)} />
                                                </div>
                                                {(searching || loadingBase) && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <Loader2 className="h-3 w-3 animate-spin" /> {loadingBase ? "Carico l'articolo..." : "Ricerca..."}
                                                    </div>
                                                )}
                                                <div className="max-h-64 divide-y overflow-y-auto rounded-md border">
                                                    {results.map(item => (
                                                        <button type="button" key={item.id} onClick={() => pickBase(item)}
                                                            className="flex w-full items-center justify-between gap-2 p-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                                                            <span>
                                                                <span className="font-medium">{item.name}</span>
                                                                {item.model && <span className="text-slate-500"> — {item.model}</span>}
                                                                <span className="block text-xs text-slate-500">{[item.brand, item.type, item.code].filter(Boolean).join(" · ")}</span>
                                                            </span>
                                                            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                                                        </button>
                                                    ))}
                                                    {!searching && search.trim().length >= 2 && results.length === 0 && (
                                                        <div className="p-3 text-center text-xs text-slate-500">Nessun articolo trovato</div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Pagina 2: tipologia, informazioni e variante ── */}
                        {step === 1 && (
                            <div className="space-y-4">
                                {isVariant && (
                                    <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                                        Variante di <b>{baseLabel || draft.name}</b>: i dati sono precompilati, indica ciò che la distingue.
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label>Tipologia *</Label>
                                    <Select value={draft.type} onValueChange={changeType}>
                                        <SelectTrigger><SelectValue placeholder="Seleziona tipologia" /></SelectTrigger>
                                        <SelectContent>
                                            {types.map(t => (
                                                <SelectItem key={t.id} value={t.name}>
                                                    {t.name}{t.variantTemplate ? " ✓" : ""}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-slate-500">
                                        Le tipologie con ✓ hanno una scheda guidata per la variante.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="w-name">Nome prodotto *</Label>
                                    <Input id="w-name" value={draft.name} onChange={e => patch({ name: e.target.value })} />
                                </div>

                                {/* Variante: scheda guidata oppure testo libero */}
                                {useMask ? (
                                    <div className="space-y-3 rounded-md border p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">Variante / modello</span>
                                            <Button variant="ghost" size="sm"
                                                onClick={() => patch({ customModel: true })}>
                                                <Pencil className="mr-1 h-3 w-3" /> Scrivi a mano
                                            </Button>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {visibleFields.map(f => (
                                                <TemplateFieldInput key={f.key} field={f}
                                                    value={draft.variantAttributes[f.key] ?? ""}
                                                    onChange={v => setAttribute(f.key, v)}
                                                    suggestions={Array.from(new Set([...(f.options ?? []), ...(usedValues[f.key] ?? [])]))} />
                                            ))}
                                        </div>
                                        <div className="rounded bg-slate-50 p-2 text-sm dark:bg-slate-800/40">
                                            <span className="text-xs text-slate-500">Variante risultante: </span>
                                            <span className="font-medium">{composed || "—"}</span>
                                        </div>
                                        {isVariant && draft.baseModel && (
                                            <p className="text-[11px] text-slate-500">L&apos;originale ha: {draft.baseModel}</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="w-model">Variante / modello / dimensioni{isVariant ? " *" : ""}</Label>
                                            {template && draft.customModel && (
                                                <Button variant="ghost" size="sm" onClick={() => {
                                                    const attrs = { ...defaultValues(template), ...draft.variantAttributes };
                                                    patch({ customModel: false, variantAttributes: attrs, model: composeVariant(template, attrs) });
                                                }}>
                                                    Usa la scheda guidata
                                                </Button>
                                            )}
                                        </div>
                                        <Input id="w-model" placeholder="Es. 12,5 mm, 200x120, grigio..." value={draft.model}
                                            onChange={e => patch({ model: e.target.value })} />
                                        {isVariant && draft.baseModel && (
                                            <p className="text-[11px] text-slate-500">L&apos;originale ha: {draft.baseModel}</p>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="w-desc">Descrizione</Label>
                                    <Textarea id="w-desc" className="min-h-[90px]" value={draft.description}
                                        onChange={e => patch({ description: e.target.value })} />
                                </div>

                                <div className="space-y-2 rounded-md border p-3">
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox checked={draft.wantsImage}
                                            onCheckedChange={v => patch({ wantsImage: v === true })} />
                                        Voglio inserire la foto
                                    </label>
                                    {draft.wantsImage ? (
                                        <div className="flex items-center gap-3">
                                            {(previewUrl || draft.imageUrl) && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={draft.imageFile ? previewUrl : draft.imageUrl} alt="Anteprima"
                                                    className="h-20 w-20 rounded-md border object-cover" />
                                            )}
                                            <Label htmlFor="w-image" className="cursor-pointer">
                                                <span className="inline-flex h-9 items-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80">
                                                    <Upload className="mr-2 h-4 w-4" /> {draft.imageFile ? "Cambia foto" : "Carica foto"}
                                                </span>
                                                <input id="w-image" type="file" accept="image/*" className="hidden" onChange={onPickImage} />
                                            </Label>
                                        </div>
                                    ) : draft.imageUrl ? (
                                        <p className="text-[11px] text-slate-500">Verrà mantenuta la foto dell&apos;articolo copiato.</p>
                                    ) : null}
                                </div>

                                <div className="space-y-2 rounded-md border p-3">
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox checked={draft.hasSupplierCode}
                                            onCheckedChange={v => patch({ hasSupplierCode: v === true, supplierCode: v === true ? draft.supplierCode : "" })} />
                                        L&apos;articolo ha un codice fornitore / originale
                                    </label>
                                    {draft.hasSupplierCode && (
                                        <Input placeholder="Es. codice catalogo del fornitore" value={draft.supplierCode}
                                            onChange={e => patch({ supplierCode: e.target.value })} />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── Pagina 3: marca, unità e scorta minima ── */}
                        {step === 2 && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="w-brand">Marca *</Label>
                                    <Input id="w-brand" autoFocus placeholder="Scrivi per cercare o aggiungere una marca..."
                                        value={brandQuery}
                                        onChange={e => {
                                            setBrandQuery(e.target.value);
                                            // La marca vale solo se corrisponde a una marca esistente
                                            const exact = brands.find(b => b.name.toLowerCase() === e.target.value.trim().toLowerCase());
                                            patch({ brand: exact ? exact.name : "" });
                                        }} />
                                    <div className="flex flex-wrap gap-2">
                                        {brandMatches.map(b => (
                                            <button type="button" key={b.id}
                                                onClick={() => { patch({ brand: b.name }); setBrandQuery(b.name); }}
                                                className={`rounded-full border px-3 py-1 text-xs ${draft.brand === b.name ? "border-blue-600 bg-blue-50 text-blue-700" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                                                {draft.brand === b.name && <Check className="mr-1 inline h-3 w-3" />}{b.name}
                                            </button>
                                        ))}
                                        {brandQuery.trim() && !exactBrand && (
                                            <button type="button" onClick={addBrand} disabled={addingBrand}
                                                className="inline-flex items-center rounded-full border border-dashed border-blue-400 px-3 py-1 text-xs text-blue-700 hover:bg-blue-50">
                                                {addingBrand ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                                                Aggiungi la marca &quot;{brandQuery.trim()}&quot;
                                            </button>
                                        )}
                                    </div>
                                    {draft.brand && <p className="text-[11px] text-slate-500">Marca selezionata: <b>{draft.brand}</b></p>}
                                </div>

                                <div className="space-y-2">
                                    <Label>Unità di misura *</Label>
                                    <Select value={draft.unit} onValueChange={v => patch({ unit: v })}>
                                        <SelectTrigger><SelectValue placeholder="Seleziona unità" /></SelectTrigger>
                                        <SelectContent>
                                            {units.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2 rounded-md border p-3">
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox checked={draft.wantsMinStock}
                                            onCheckedChange={v => patch({ wantsMinStock: v === true, minStock: v === true ? (draft.minStock === "0" ? "" : draft.minStock) : "0" })} />
                                        Voglio un avviso quando la scorta scende sotto una soglia
                                    </label>
                                    {draft.wantsMinStock ? (
                                        <div className="flex items-center gap-2">
                                            <Input className="w-32" type="number" min="0" step="0.01" placeholder="Es. 10"
                                                value={draft.minStock} onChange={e => patch({ minStock: e.target.value })} />
                                            <span className="text-sm text-slate-500">{unitLabel}</span>
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-slate-500">Senza spunta la scorta minima resta a 0 e non scatta nessun avviso.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── Pagina 4: coefficiente e confezione ── */}
                        {step === 3 && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="w-coeff">Coefficiente di moltiplicazione</Label>
                                    <div className="flex items-center gap-2">
                                        <Input id="w-coeff" autoFocus className="w-32" type="number" min="0.01" step="0.01"
                                            value={draft.coefficient} onChange={e => patch({ coefficient: e.target.value })} />
                                        <span className="text-sm text-slate-500">{unitLabel} per pezzo fisico</span>
                                    </div>
                                    <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/40 dark:text-slate-300">
                                        Il coefficiente converte l&apos;unità di magazzino (<b>{unitLabel}</b>) nei pezzi fisici.
                                        Esempio: una lastra di cartongesso 2500x1200 mm vale 3 mq; se in magazzino conti i mq,
                                        il coefficiente è 3. Se l&apos;articolo si conta a pezzi interi lascia <b>1</b>.
                                        Dopo la creazione potrà modificarlo solo un Admin.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="w-pack">Quantità per confezione <span className="font-normal text-slate-500">(facoltativa)</span></Label>
                                    <div className="flex items-center gap-2">
                                        <Input id="w-pack" className="w-32" type="number" min="0" step="0.01" placeholder="Es. 18"
                                            value={draft.packQuantity} onChange={e => patch({ packQuantity: e.target.value })} />
                                        <span className="text-sm text-slate-500">{unitLabel} in una confezione</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                        Quante {unitLabel} ci sono normalmente in una scatola o confezione. Aiuta a segnalare acquisti
                                        con prezzo o quantità che non tornano.
                                    </p>
                                </div>

                                <div className="rounded-md border p-3 text-xs text-slate-600 dark:text-slate-300">
                                    <div className="mb-1 font-medium text-slate-800 dark:text-slate-100">Riepilogo</div>
                                    <div>{draft.name}{composed ? ` — ${composed}` : ""}</div>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {draft.brand && <Badge variant="outline">{draft.brand}</Badge>}
                                        {draft.type && <Badge variant="outline">{draft.type}</Badge>}
                                        <Badge variant="outline">{unitLabel}</Badge>
                                        {draft.wantsMinStock && <Badge variant="outline">scorta minima {draft.minStock}</Badge>}
                                        {draft.supplierCode && <Badge variant="outline">cod. {draft.supplierCode}</Badge>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {errors.length > 0 && (
                            <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-400">
                                {errors.map(e => <li key={e}>• {e}</li>)}
                            </ul>
                        )}
                    </div>

                    <div className="flex items-center justify-between border-t pt-3">
                        <Button variant="outline" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0 || creating}>
                            <ArrowLeft className="mr-1 h-4 w-4" /> Indietro
                        </Button>
                        {step < STEPS.length - 1 ? (
                            <Button onClick={() => setStep(s => s + 1)} disabled={!canNext || loadingBase}>
                                Avanti <ArrowRight className="ml-1 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button className="bg-blue-600 hover:bg-blue-700" onClick={create} disabled={!canNext || creating}>
                                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                Crea articolo
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
});
