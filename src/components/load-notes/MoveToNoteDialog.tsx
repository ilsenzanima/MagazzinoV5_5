"use client"

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { JobSelectorDialog } from "@/components/jobs/JobSelectorDialog";
import { jobsApi, Job } from "@/lib/api";
import { LoadNote } from "@/lib/types";
import { loadNotesService } from "@/lib/services/load-notes";
import { vansService, VanItem, VanMove } from "@/lib/services/vans";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // Righe del furgone da spostare: per ognuna si sceglie quanto spostare (di default tutto)
    items: VanItem[];
    // Chiamata a spostamento riuscito, con l'id della nota che ha ricevuto il materiale
    onMoved: (noteId: string) => void;
}

const round = (n: number) => Math.round(n * 100) / 100;

const noteLabel = (n: LoadNote) => {
    const job = n.jobDescription || n.jobCode;
    const base = job || (n.notes ? n.notes.slice(0, 40) : "Senza commessa");
    return `${new Date(n.date).toLocaleDateString("it-IT")} · ${base}`;
};

// Sposta le righe scelte del furgone su una nota di carico: una già aperta oppure una nuova (con o senza commessa)
export function MoveToNoteDialog({ open, onOpenChange, items, onMoved }: Props) {
    const [mode, setMode] = useState<"existing" | "new">("existing");
    const [notes, setNotes] = useState<LoadNote[]>([]);
    const [noteId, setNoteId] = useState("");
    const [job, setJob] = useState<Job | null>(null);
    const [text, setText] = useState("");
    const [noteType, setNoteType] = useState<"uscita" | "reso">("uscita");
    const [jobs, setJobs] = useState<Job[]>([]);
    const [jobsLoading, setJobsLoading] = useState(false);
    const [jobPickerOpen, setJobPickerOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    // Quantità e pezzi da spostare per ogni riga, come testo dei campi
    const [amounts, setAmounts] = useState<Record<string, { pieces: string; quantity: string }>>({});

    const searchJobs = useCallback(async (term: string) => {
        setJobsLoading(true);
        try {
            const { data } = await jobsApi.getPaginated({ page: 1, limit: 50, search: term, status: "active" });
            setJobs(data);
        } catch {
            toast.error("Errore nella ricerca delle commesse");
        } finally {
            setJobsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!open) return;
        setMode("existing"); setNoteId(""); setJob(null); setText(""); setNoteType("uscita");
        setAmounts(Object.fromEntries(items.map(i => [i.id, { pieces: i.pieces == null ? "" : String(i.pieces), quantity: String(i.quantity) }])));
        loadNotesService.getAll({ status: "pending" }).then(setNotes).catch(() => toast.error("Errore nel caricamento delle note"));
        searchJobs("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, searchJobs]);

    const options = useMemo(() => notes.map(n => ({ value: n.id, label: noteLabel(n) })), [notes]);

    // Pezzi e quantità sono legati dal coefficiente dell'articolo: cambiando uno si ricalcola l'altro
    const setAmount = (item: VanItem, field: "pieces" | "quantity", raw: string) => {
        const value = parseFloat(raw);
        const coefficient = item.coefficient && item.coefficient > 0 ? item.coefficient : 1;
        setAmounts(prev => {
            if (!(value >= 0)) return { ...prev, [item.id]: { ...prev[item.id], [field]: raw } };
            const other = field === "pieces" ? String(round(value * coefficient)) : String(round(value / coefficient));
            return { ...prev, [item.id]: field === "pieces" ? { pieces: raw, quantity: other } : { quantity: raw, pieces: item.pieces == null ? "" : other } };
        });
    };

    const rowQty = (id: string) => parseFloat(amounts[id]?.quantity ?? "");
    const rowsValid = items.length > 0 && items.every(i => rowQty(i.id) > 0 && rowQty(i.id) <= i.quantity + 1e-9);
    const canConfirm = rowsValid && (mode === "existing" ? !!noteId : !!job || text.trim().length > 0);

    const confirm = async () => {
        setBusy(true);
        try {
            const moves: VanMove[] = items.map(i => {
                const pieces = parseFloat(amounts[i.id]?.pieces ?? "");
                return { id: i.id, quantity: rowQty(i.id), pieces: pieces > 0 ? pieces : undefined };
            });
            const target = mode === "existing"
                ? (await vansService.moveToNote(moves, noteId), noteId)
                : await vansService.moveToNewNote(moves, { jobId: job?.id, notes: text.trim() || undefined, date: new Date().toISOString().split("T")[0], noteType });
            toast.success(`${items.length} ${items.length === 1 ? "riga spostata" : "righe spostate"} sulla nota`);
            onOpenChange(false);
            onMoved(target);
        } catch (e: any) {
            toast.error(e?.message || "Impossibile spostare il materiale");
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Sposta su una nota di carico</DialogTitle>
                        <DialogDescription>
                            Scegli quanto spostare di ogni materiale: se ne sposti solo una parte, il resto resta sul furgone. Se la nota ha già lo stesso articolo, le quantità si sommano.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
                        {items.map(i => {
                            const a = amounts[i.id] || { pieces: "", quantity: "" };
                            const q = parseFloat(a.quantity);
                            const invalid = a.quantity !== "" && (!(q > 0) || q > i.quantity + 1e-9);
                            return (
                                <div key={i.id} className="space-y-1 border-b pb-2 last:border-b-0 last:pb-0">
                                    <div className="min-w-0">
                                        <span className="font-mono text-[10px] text-muted-foreground">{i.inventoryCode}</span>
                                        <div className="break-words text-sm font-medium leading-tight">{i.inventoryName}</div>
                                        {i.inventoryModel && <div className="break-words text-xs text-muted-foreground">{i.inventoryModel}</div>}
                                    </div>
                                    <div className="flex items-end gap-2">
                                        {i.pieces != null && (
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">Pezzi</Label>
                                                <Input type="number" inputMode="decimal" min="0" step="0.01" className="h-9 w-24 text-center"
                                                    value={a.pieces} onChange={e => setAmount(i, "pieces", e.target.value)} />
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Quantità ({i.inventoryUnit})</Label>
                                            <Input type="number" inputMode="decimal" min="0" step="0.01" className={`h-9 w-28 text-center ${invalid ? "border-destructive" : ""}`}
                                                value={a.quantity} onChange={e => setAmount(i, "quantity", e.target.value)} />
                                        </div>
                                        <span className="pb-2 text-xs text-muted-foreground">su {i.quantity} {i.inventoryUnit}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex gap-1">
                        <Button type="button" size="sm" variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")}>Nota esistente</Button>
                        <Button type="button" size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>Nuova nota</Button>
                    </div>

                    {mode === "existing" ? (
                        <div className="space-y-2">
                            <Label>Nota da processare</Label>
                            <SearchableSelect options={options} value={noteId} onValueChange={setNoteId}
                                placeholder="Scegli la nota..." searchPlaceholder="Cerca per commessa o data..." />
                            {options.length === 0 && <p className="text-xs text-muted-foreground">Non ci sono note da processare: crea una nota nuova.</p>}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label>Commessa (facoltativa)</Label>
                                <div className="flex h-10 cursor-pointer items-center justify-between rounded-md border px-3 py-2 hover:bg-muted" onClick={() => setJobPickerOpen(true)}>
                                    {job ? (
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="truncate text-sm font-medium">{job.code}</span>
                                            <span className="truncate text-[10px] text-muted-foreground">{job.name}</span>
                                        </div>
                                    ) : <span className="text-sm text-muted-foreground">Seleziona commessa...</span>}
                                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                                </div>
                                {job && <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setJob(null)}>Togli commessa</Button>}
                            </div>
                            <div className="space-y-2">
                                <Label>Note {!job && <span className="text-xs text-destructive">*</span>}</Label>
                                <Textarea className="h-20 resize-none" placeholder="Servono commessa o note" value={text} onChange={e => setText(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Tipo</Label>
                                <div className="flex gap-1">
                                    <Button type="button" size="sm" variant={noteType === "uscita" ? "default" : "outline"} onClick={() => setNoteType("uscita")}>Uscita</Button>
                                    <Button type="button" size="sm" variant={noteType === "reso" ? "default" : "outline"} onClick={() => setNoteType("reso")}>Reso</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annulla</Button>
                        <Button className="bg-blue-600 hover:bg-blue-700" disabled={!canConfirm || busy} onClick={confirm}>
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sposta"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <JobSelectorDialog open={jobPickerOpen} onOpenChange={setJobPickerOpen} onSelect={(j) => { setJob(j); setJobPickerOpen(false); }}
                jobs={jobs} onSearch={searchJobs} loading={jobsLoading} />
        </>
    );
}
