"use client"

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/components/auth-provider";
import { itemTypesApi, ItemType } from "@/lib/api";
import { notify } from "@/lib/notify";
import {
    SUBTYPE_KEY, VariantCoefficientRule, VariantField, VariantSection, VariantSubtype, VariantTemplate, VariantValues,
    composeVariant, isFieldVisible, keyFromLabel,
} from "@/lib/utils/variant-template";

const EMPTY_TEMPLATE: VariantTemplate = { version: 2, pattern: "", fields: [] };

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export default function SchedeVariantiPage() {
    const { userRole, realRole } = useAuth();
    const isAdmin = userRole === "admin" || realRole === "admin";

    const [types, setTypes] = useState<ItemType[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [template, setTemplate] = useState<VariantTemplate>(clone(EMPTY_TEMPLATE));
    const [subIndex, setSubIndex] = useState(0);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sample, setSample] = useState<VariantValues>({});

    const load = async () => {
        setLoading(true);
        try {
            setTypes(await itemTypesApi.getAll());
        } catch {
            notify.error("Errore nel caricamento delle tipologie");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

    const selected = types.find(t => t.id === selectedId) ?? null;
    const hasSubs = !!template.subtypes && template.subtypes.length > 0;
    const activeSub: VariantSubtype | null = hasSubs ? template.subtypes![Math.min(subIndex, template.subtypes!.length - 1)] : null;
    // La sezione in modifica: un sottotipo oppure la scheda stessa
    const section: VariantSection = activeSub ?? template;

    const select = (t: ItemType) => {
        if (dirty && !confirm("Ci sono modifiche non salvate. Cambiare tipologia?")) return;
        setSelectedId(t.id);
        setTemplate(t.variantTemplate ? clone(t.variantTemplate) : clone(EMPTY_TEMPLATE));
        setSubIndex(0);
        setSample({});
        setDirty(false);
    };

    const update = (next: VariantTemplate) => { setTemplate(next); setDirty(true); };
    const updateSection = (patch: Partial<VariantSection>) => {
        if (!activeSub) return update({ ...template, ...patch });
        update({ ...template, subtypes: template.subtypes!.map((s, i) => (i === subIndex ? { ...s, ...patch } : s)) });
    };
    const updateField = (index: number, patch: Partial<VariantField>) =>
        updateSection({ fields: section.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) });
    const moveField = (index: number, dir: -1 | 1) => {
        const target = index + dir;
        if (target < 0 || target >= section.fields.length) return;
        const fields = [...section.fields];
        [fields[index], fields[target]] = [fields[target], fields[index]];
        updateSection({ fields });
    };
    const removeField = (index: number) => updateSection({ fields: section.fields.filter((_, i) => i !== index) });
    const addField = () => {
        const used = new Set(section.fields.map(f => f.key));
        let n = section.fields.length + 1;
        while (used.has(`campo_${n}`)) n++;
        updateSection({ fields: [...section.fields, { key: `campo_${n}`, label: `Nuovo campo ${n}`, kind: "text" }] });
    };

    // ── Sottotipi ───────────────────────────────────────────────────────────
    const toggleSubtypes = (on: boolean) => {
        if (on) {
            const first: VariantSubtype = { key: "sottotipo_1", label: "Sottotipo 1", pattern: template.pattern, fields: template.fields, coefficient: template.coefficient };
            update({ ...template, pattern: "", fields: [], coefficient: undefined, subtypeLabel: template.subtypeLabel ?? "Tipo", subtypes: [first] });
            setSubIndex(0);
        } else {
            if (template.subtypes && template.subtypes.length > 1 &&
                !confirm("Disattivando i sottotipi resta solo il primo. Continuare?")) return;
            const first = template.subtypes?.[0];
            const { subtypes: _s, subtypeLabel: _l, ...rest } = template;
            update({ ...rest, pattern: first?.pattern ?? "", fields: first?.fields ?? [], coefficient: first?.coefficient });
        }
    };
    const updateSub = (patch: Partial<VariantSubtype>) =>
        update({ ...template, subtypes: template.subtypes!.map((s, i) => (i === subIndex ? { ...s, ...patch } : s)) });
    const addSubtype = () => {
        const used = new Set(template.subtypes!.map(s => s.key));
        let n = template.subtypes!.length + 1;
        while (used.has(`sottotipo_${n}`)) n++;
        update({ ...template, subtypes: [...template.subtypes!, { key: `sottotipo_${n}`, label: `Sottotipo ${n}`, pattern: "", fields: [] }] });
        setSubIndex(template.subtypes!.length);
    };
    const removeSubtype = () => {
        if (!confirm(`Eliminare il sottotipo "${activeSub?.label}"?`)) return;
        update({ ...template, subtypes: template.subtypes!.filter((_, i) => i !== subIndex) });
        setSubIndex(0);
    };

    // ── Coefficiente automatico ─────────────────────────────────────────────
    const numberFields = section.fields.filter(f => f.kind === "number");
    const rule = section.coefficient;
    const setRule = (patch: Partial<VariantCoefficientRule> | null) => {
        if (patch === null) return updateSection({ coefficient: undefined });
        const base: VariantCoefficientRule = rule ?? { kind: "length", lengthKey: numberFields[0]?.key ?? "", whenUnit: "ML" };
        updateSection({ coefficient: { ...base, ...patch } });
    };

    // Controlli di coerenza di tutte le sezioni
    const problems = useMemo(() => {
        const list: string[] = [];
        const sections: { name: string; s: VariantSection }[] =
            template.subtypes && template.subtypes.length > 0
                ? template.subtypes.map(s => ({ name: s.label, s }))
                : [{ name: "Scheda", s: template }];
        const subKeys = (template.subtypes ?? []).map(s => s.key);
        if (new Set(subKeys).size !== subKeys.length) list.push("Due sottotipi hanno la stessa chiave");
        for (const { name, s } of sections) {
            const keys = s.fields.map(f => f.key);
            if (new Set(keys).size !== keys.length) list.push(`${name}: due campi hanno la stessa chiave`);
            if (s.fields.some(f => !f.label.trim())) list.push(`${name}: ogni campo ha bisogno di un nome`);
            const tokens = Array.from(s.pattern.matchAll(/\{([a-zA-Z0-9_]+)\}/g)).map(m => m[1]);
            for (const t of tokens) if (!keys.includes(t)) list.push(`${name}: il modello usa {${t}}, che non è un campo`);
            for (const f of s.fields) if (!tokens.includes(f.key)) list.push(`${name}: il campo "${f.label}" non compare nel modello`);
            if (s.coefficient && !keys.includes(s.coefficient.lengthKey)) list.push(`${name}: il coefficiente usa un campo che non esiste`);
        }
        return list;
    }, [template]);

    const save = async (clear = false) => {
        if (!selected) return;
        const empty = hasSubs ? template.subtypes!.every(s => s.fields.length === 0) : template.fields.length === 0;
        if (!clear && empty) { notify.error("Aggiungi almeno un campo, oppure usa «Rimuovi scheda»"); return; }
        if (!clear && problems.length > 0) { notify.error(problems[0]); return; }
        setSaving(true);
        try {
            const value = clear ? null : template;
            await itemTypesApi.updateTemplate(selected.id, value);
            setTypes(prev => prev.map(t => (t.id === selected.id ? { ...t, variantTemplate: value } : t)));
            if (clear) setTemplate(clone(EMPTY_TEMPLATE));
            setDirty(false);
            notify.success(clear ? "Scheda rimossa" : "Scheda salvata");
        } catch (e: any) {
            notify.error(e?.message || "Impossibile salvare la scheda (solo gli admin possono modificarla)");
        } finally {
            setSaving(false);
        }
    };

    if (!isAdmin) {
        return (
            <DashboardLayout>
                <Alert>
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Accesso Limitato</AlertTitle>
                    <AlertDescription>Non hai i permessi di amministratore per visualizzare questa sezione.</AlertDescription>
                </Alert>
            </DashboardLayout>
        );
    }

    const sampleValues: VariantValues = activeSub ? { ...sample, [SUBTYPE_KEY]: activeSub.key } : sample;
    const visibleSample = section.fields.filter(f => isFieldVisible(f, sampleValues));

    return (
        <DashboardLayout>
            <div className="space-y-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Schede varianti</h1>
                    <p className="text-sm text-slate-500">
                        Per ogni tipologia definisci i campi che compongono la variante degli articoli (misure, scelte, testo).
                        I <b>sottotipi</b> non sono nuove tipologie: servono solo a scegliere quali campi chiedere (es. nelle Porte:
                        porta, telaio, maniglione).
                    </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
                    {/* Elenco tipologie */}
                    <Card className="h-fit">
                        <CardHeader className="pb-2"><CardTitle className="text-base">Tipologie</CardTitle></CardHeader>
                        <CardContent className="p-2">
                            {loading ? (
                                <div className="p-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
                            ) : (
                                <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
                                    {types.map(t => (
                                        <li key={t.id}>
                                            <button type="button" onClick={() => select(t)}
                                                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${selectedId === t.id ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                                                <span>{t.name}</span>
                                                {t.variantTemplate && <Check className="h-4 w-4 text-emerald-600" />}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    {/* Editor */}
                    {!selected ? (
                        <Card><CardContent className="p-8 text-center text-sm text-slate-500">Seleziona una tipologia per vedere o creare la sua scheda.</CardContent></Card>
                    ) : (
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        {selected.name}
                                        {selected.variantTemplate ? <Badge variant="secondary">con scheda</Badge> : <Badge variant="outline">senza scheda</Badge>}
                                    </CardTitle>
                                    <CardDescription>
                                        Nel modello i campi si scrivono tra graffe, per esempio <code>{"{larghezza}x{ala}x{lunghezza} [sp.{spessore}]"}</code>.
                                        Le parti tra quadre compaiono solo se tutti i campi al loro interno sono compilati.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox checked={hasSubs} onCheckedChange={v => toggleSubtypes(v === true)} />
                                        Questa tipologia ha dei sottotipi (campi diversi a seconda del tipo di articolo)
                                    </label>

                                    {hasSubs && (
                                        <div className="space-y-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="w-52 space-y-1">
                                                    <Label className="text-xs">Domanda per il sottotipo</Label>
                                                    <Input value={template.subtypeLabel ?? ""} placeholder="Es. Componente"
                                                        onChange={e => update({ ...template, subtypeLabel: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {template.subtypes!.map((s, i) => (
                                                    <button type="button" key={s.key} onClick={() => setSubIndex(i)}
                                                        className={`rounded-full border px-3 py-1 text-xs ${i === subIndex ? "border-blue-600 bg-blue-50 text-blue-700" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                                                        {s.label}
                                                    </button>
                                                ))}
                                                <button type="button" onClick={addSubtype}
                                                    className="inline-flex items-center rounded-full border border-dashed border-blue-400 px-3 py-1 text-xs text-blue-700 hover:bg-blue-50">
                                                    <Plus className="mr-1 h-3 w-3" />Aggiungi sottotipo
                                                </button>
                                            </div>
                                            {activeSub && (
                                                <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs">Nome del sottotipo</Label>
                                                        <Input value={activeSub.label} onChange={e => {
                                                            const label = e.target.value;
                                                            const auto = activeSub.key === keyFromLabel(activeSub.label) || /^sottotipo_\d+$/.test(activeSub.key);
                                                            updateSub({ label, ...(auto ? { key: keyFromLabel(label) } : {}) });
                                                        }} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-xs">Nome proposto all&apos;articolo</Label>
                                                        <Input value={activeSub.suggestedName ?? ""} placeholder="Es. Telaio per porta"
                                                            onChange={e => updateSub({ suggestedName: e.target.value || undefined })} />
                                                    </div>
                                                    <div className="flex items-end">
                                                        <Button variant="outline" onClick={removeSubtype} disabled={template.subtypes!.length <= 1}>
                                                            <Trash2 className="mr-2 h-4 w-4 text-red-500" />Elimina sottotipo
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <Label htmlFor="pattern">Modello della variante{activeSub ? ` — ${activeSub.label}` : ""}</Label>
                                        <Input id="pattern" className="font-mono text-sm" value={section.pattern}
                                            onChange={e => updateSection({ pattern: e.target.value })} />
                                    </div>

                                    {/* Coefficiente automatico */}
                                    <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-4">
                                        <div className="space-y-1 sm:col-span-1">
                                            <Label className="text-xs">Coefficiente automatico</Label>
                                            <Select value={rule?.kind ?? "none"} onValueChange={v => v === "none" ? setRule(null) : setRule({ kind: v as "area" | "length" })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Nessuno</SelectItem>
                                                    <SelectItem value="length">Lunghezza in metri (ML)</SelectItem>
                                                    <SelectItem value="area">Area in m² (MQ)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {rule && (
                                            <>
                                                {rule.kind === "area" && (
                                                    <div className="space-y-1">
                                                        <Label className="text-xs">Campo larghezza (mm)</Label>
                                                        <Select value={rule.widthKey ?? ""} onValueChange={v => setRule({ widthKey: v })}>
                                                            <SelectTrigger><SelectValue placeholder="Scegli..." /></SelectTrigger>
                                                            <SelectContent>{numberFields.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Campo lunghezza (mm)</Label>
                                                    <Select value={rule.lengthKey} onValueChange={v => setRule({ lengthKey: v })}>
                                                        <SelectTrigger><SelectValue placeholder="Scegli..." /></SelectTrigger>
                                                        <SelectContent>{numberFields.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Con unità</Label>
                                                    <Input value={rule.whenUnit} onChange={e => setRule({ whenUnit: e.target.value })} />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {problems.length > 0 && (
                                        <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-400">
                                            {problems.map(p => <li key={p}>• {p}</li>)}
                                        </ul>
                                    )}
                                </CardContent>
                            </Card>

                            <div className="space-y-3">
                                {section.fields.map((f, i) => (
                                    <Card key={`${subIndex}-${i}`}>
                                        <CardContent className="space-y-3 p-4">
                                            <div className="flex flex-wrap items-end gap-3">
                                                <div className="min-w-[180px] flex-1 space-y-1">
                                                    <Label className="text-xs">Nome del campo</Label>
                                                    <Input value={f.label} onChange={e => {
                                                        const label = e.target.value;
                                                        // finché la chiave è quella automatica la si aggiorna col nome
                                                        const auto = f.key === keyFromLabel(f.label) || /^campo_\d+$/.test(f.key);
                                                        updateField(i, { label, ...(auto ? { key: keyFromLabel(label) } : {}) });
                                                    }} />
                                                </div>
                                                <div className="w-40 space-y-1">
                                                    <Label className="text-xs">Tipo</Label>
                                                    <Select value={f.kind} onValueChange={(v: VariantField["kind"]) => updateField(i, { kind: v })}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="number">Numero</SelectItem>
                                                            <SelectItem value="choice">Scelta</SelectItem>
                                                            <SelectItem value="text">Testo</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="w-28 space-y-1">
                                                    <Label className="text-xs">Unità</Label>
                                                    <Input placeholder="mm" value={f.unit ?? ""} onChange={e => updateField(i, { unit: e.target.value || undefined })} />
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button variant="outline" size="icon" onClick={() => moveField(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                                                    <Button variant="outline" size="icon" onClick={() => moveField(i, 1)} disabled={i === section.fields.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                                                    <Button variant="outline" size="icon" onClick={() => removeField(i)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                                </div>
                                            </div>

                                            {f.kind === "choice" && (
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Scelte (separate da virgola)</Label>
                                                    <Input value={(f.options ?? []).join(", ")}
                                                        onChange={e => updateField(i, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} />
                                                </div>
                                            )}

                                            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                                                <label className="flex items-center gap-2"><Checkbox checked={!!f.required} onCheckedChange={v => updateField(i, { required: v === true })} />Obbligatorio</label>
                                                {f.kind === "choice" && (
                                                    <label className="flex items-center gap-2"><Checkbox checked={!!f.open} onCheckedChange={v => updateField(i, { open: v === true })} />Lista aperta (si possono scrivere valori nuovi)</label>
                                                )}
                                                <label className="flex items-center gap-2"><Checkbox checked={!!f.hideWhenDefault} onCheckedChange={v => updateField(i, { hideWhenDefault: v === true })} />Non mostrare il valore standard</label>
                                                <label className="flex items-center gap-2"><Checkbox checked={!!f.fillsPackQuantity} onCheckedChange={v => updateField(i, { fillsPackQuantity: v === true })} />È anche la quantità per confezione</label>
                                            </div>

                                            <div className="grid gap-3 sm:grid-cols-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Valore standard</Label>
                                                    <Input value={f.default ?? ""} onChange={e => updateField(i, { default: e.target.value || undefined })} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Compare solo se il campo…</Label>
                                                    <Select value={f.showIf?.key ?? "__none"}
                                                        onValueChange={v => updateField(i, { showIf: v === "__none" ? undefined : { key: v, equals: f.showIf?.equals ?? "" } })}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="__none">sempre</SelectItem>
                                                            {section.fields.filter((_, j) => j !== i).map(o => (
                                                                <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                {f.showIf && (
                                                    <div className="space-y-1">
                                                        <Label className="text-xs">…vale</Label>
                                                        <Input value={f.showIf.equals} onChange={e => updateField(i, { showIf: { key: f.showIf!.key, equals: e.target.value } })} />
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-400">Chiave nel modello: <code>{`{${f.key}}`}</code></p>
                                        </CardContent>
                                    </Card>
                                ))}
                                <Button variant="outline" onClick={addField}><Plus className="mr-2 h-4 w-4" />Aggiungi campo</Button>
                            </div>

                            {/* Anteprima */}
                            {section.fields.length > 0 && (
                                <Card>
                                    <CardHeader className="pb-2"><CardTitle className="text-base">Anteprima{activeSub ? ` — ${activeSub.label}` : ""}</CardTitle></CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {visibleSample.map(f => (
                                                <div key={f.key} className="space-y-1">
                                                    <Label className="text-xs">{f.label}</Label>
                                                    <Input value={sample[f.key] ?? ""} onChange={e => setSample({ ...sample, [f.key]: e.target.value })}
                                                        placeholder={f.kind === "choice" ? (f.options ?? []).join(" / ") : ""} />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="rounded bg-slate-50 p-2 text-sm dark:bg-slate-800/40">
                                            <span className="text-xs text-slate-500">Variante risultante: </span>
                                            <span className="font-medium">{composeVariant(template, sampleValues) || "—"}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            <div className="flex flex-wrap gap-2">
                                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => save(false)} disabled={saving || !dirty}>
                                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                    Salva scheda
                                </Button>
                                {selected.variantTemplate && (
                                    <Button variant="outline" onClick={() => { if (confirm("Rimuovere la scheda di questa tipologia? La variante tornerà a testo libero.")) save(true); }} disabled={saving}>
                                        Rimuovi scheda
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
