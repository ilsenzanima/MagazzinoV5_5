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
import { vansService } from "@/lib/services/vans";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    itemIds: string[];
    // Chiamata a spostamento riuscito, con l'id della nota che ha ricevuto il materiale
    onMoved: (noteId: string) => void;
}

const noteLabel = (n: LoadNote) => {
    const job = n.jobDescription || n.jobCode;
    const base = job || (n.notes ? n.notes.slice(0, 40) : "Senza commessa");
    return `${new Date(n.date).toLocaleDateString("it-IT")} · ${base}`;
};

// Sposta le righe scelte del furgone su una nota di carico: una già aperta oppure una nuova (con o senza commessa)
export function MoveToNoteDialog({ open, onOpenChange, itemIds, onMoved }: Props) {
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
        loadNotesService.getAll({ status: "pending" }).then(setNotes).catch(() => toast.error("Errore nel caricamento delle note"));
        searchJobs("");
    }, [open, searchJobs]);

    const options = useMemo(() => notes.map(n => ({ value: n.id, label: noteLabel(n) })), [notes]);
    const canConfirm = itemIds.length > 0 && (mode === "existing" ? !!noteId : !!job || text.trim().length > 0);

    const confirm = async () => {
        setBusy(true);
        try {
            const target = mode === "existing"
                ? (await vansService.moveToNote(itemIds, noteId), noteId)
                : await vansService.moveToNewNote(itemIds, { jobId: job?.id, notes: text.trim() || undefined, date: new Date().toISOString().split("T")[0], noteType });
            toast.success(`${itemIds.length} ${itemIds.length === 1 ? "riga spostata" : "righe spostate"} sulla nota`);
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
                            {itemIds.length} {itemIds.length === 1 ? "riga esce" : "righe escono"} dal furgone. Se la nota ha già lo stesso articolo, le quantità si sommano.
                        </DialogDescription>
                    </DialogHeader>

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
