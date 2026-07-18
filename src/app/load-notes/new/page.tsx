"use client"

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Save, Search, Loader2, ArrowUpRight, ArrowDownRight, Trash } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { loadNotesService } from "@/lib/services/load-notes";
import { ItemSelectorDialog } from "@/components/inventory/ItemSelectorDialog";
import { JobSelectorDialog } from "@/components/jobs/JobSelectorDialog";
import { inventoryApi, jobsApi, InventoryItem, Job } from "@/lib/api";
import { FieldTip } from "@/components/ui/field-tip";

interface NoteLine {
    tempId: string;
    itemId: string;
    itemName: string;
    itemModel?: string;
    itemCode?: string;
    pieces: string;
    quantity: string;
    coefficient: number;
    unit: string;
    isChecked?: boolean;
}

const emptyLine = (): NoteLine => ({
    tempId: Math.random().toString(36).substr(2, 9),
    itemId: "",
    itemName: "",
    pieces: "",
    quantity: "",
    coefficient: 1,
    unit: "PZ",
    isChecked: false,
});

const ensureTrailingEmpty = (lines: NoteLine[]): NoteLine[] => {
    const last = lines[lines.length - 1];
    if (!last || last.itemId || last.pieces || last.quantity) {
        return [...lines, emptyLine()];
    }
    return lines;
};

export default function NewLoadNotePage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [jobsLoading, setJobsLoading] = useState(false);

    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [noteType, setNoteType] = useState<'uscita' | 'reso'>('uscita');
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [notes, setNotes] = useState("");

    const [lines, setLines] = useState<NoteLine[]>([emptyLine()]);

    const [isJobSelectorOpen, setIsJobSelectorOpen] = useState(false);
    const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);
    const [openItemSelectorForRowId, setOpenItemSelectorForRowId] = useState<string | null>(null);

    const isValid = selectedJob || notes.trim().length > 0;

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setInitialLoading(true);
            const [inventoryData, jobsData] = await Promise.all([
                inventoryApi.getPaginated({ page: 1, limit: 50 }),
                jobsApi.getPaginated({ page: 1, limit: 50, status: 'active' })
            ]);
            setInventory(inventoryData.items);
            setJobs(jobsData.data);
        } catch (error) {
            console.error("Failed to load data", error);
            toast.error("Errore nel caricamento dei dati. Riprova.");
        } finally {
            setInitialLoading(false);
        }
    };

    const handleItemSearch = useCallback(async (term: string) => {
        setItemsLoading(true);
        try {
            const { items } = await inventoryApi.getPaginated({ page: 1, limit: 50, search: term });
            setInventory(items);
        } catch (error) {
            console.error("Failed to search items", error);
            toast.error("Errore nella ricerca dei materiali. Riprova.");
        } finally {
            setItemsLoading(false);
        }
    }, []);

    const handleJobSearch = useCallback(async (term: string) => {
        setJobsLoading(true);
        try {
            const { data } = await jobsApi.getPaginated({ page: 1, limit: 50, search: term, status: 'active' });
            setJobs(data);
        } catch (error) {
            console.error("Failed to search jobs", error);
            toast.error("Errore nella ricerca delle commesse. Riprova.");
        } finally {
            setJobsLoading(false);
        }
    }, []);

    const openItemSelector = (rowId: string) => {
        setOpenItemSelectorForRowId(rowId);
        setIsItemSelectorOpen(true);
    };

    const handleItemSelect = (item: InventoryItem) => {
        if (!openItemSelectorForRowId) return;
        setLines(prev => {
            const updated = prev.map(line => {
                if (line.tempId !== openItemSelectorForRowId) return line;
                return {
                    ...line,
                    itemId: item.id,
                    itemName: item.name,
                    itemModel: item.model,
                    itemCode: item.code,
                    coefficient: item.coefficient ? Number(item.coefficient) : 1,
                    unit: item.unit || 'PZ',
                    pieces: "",
                    quantity: "",
                };
            });
            return ensureTrailingEmpty(updated);
        });
        setOpenItemSelectorForRowId(null);
        setIsItemSelectorOpen(false);
    };

    const handleJobSelect = (job: Job) => {
        setSelectedJob(job);
        setIsJobSelectorOpen(false);
    };

    const handleLinePiecesChange = (tempId: string, piecesStr: string) => {
        setLines(prev => {
            const updated = prev.map(line => {
                if (line.tempId !== tempId) return line;
                const pieces = parseFloat(piecesStr);
                const quantity = !isNaN(pieces)
                    ? (pieces * line.coefficient).toFixed(2)
                    : line.quantity;
                return { ...line, pieces: piecesStr, quantity };
            });
            return ensureTrailingEmpty(updated);
        });
    };

    const handleLineQuantityChange = (tempId: string, quantityStr: string) => {
        setLines(prev => {
            const updated = prev.map(line => {
                if (line.tempId !== tempId) return line;
                const quantity = parseFloat(quantityStr);
                let piecesStr = line.pieces;
                if (!isNaN(quantity)) {
                    piecesStr = line.coefficient !== 1
                        ? (quantity / line.coefficient).toFixed(2)
                        : quantity.toString();
                }
                return { ...line, quantity: quantityStr, pieces: piecesStr };
            });
            return ensureTrailingEmpty(updated);
        });
    };

    const removeLine = (tempId: string) => {
        setLines(prev => {
            if (prev.length === 1) return [emptyLine()];
            const updated = prev.filter(l => l.tempId !== tempId);
            return ensureTrailingEmpty(updated);
        });
    };

    const handleSave = async () => {
        if (!isValid) {
            toast.error("Devi selezionare una commessa o inserire delle note.");
            return;
        }

        const validLines = lines.filter(l => l.itemId && l.quantity);
        setIsLoading(true);
        try {
            const created = await loadNotesService.create({
                date,
                noteType,
                jobId: selectedJob?.id,
                notes,
                items: validLines.map(l => ({
                    inventoryId: l.itemId,
                    quantity: parseFloat(l.quantity),
                    pieces: parseFloat(l.pieces) || parseFloat(l.quantity),
                    coefficient: l.coefficient
                }))
            });

            toast.success("Nota creata con successo");
            router.push(`/load-notes/${created.id}`);
        } catch (error: any) {
            console.error(error);
            toast.error(`Errore durante il salvataggio: ${error.message || "Errore sconosciuto"}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto pb-10 overflow-hidden">
                <div className="mb-6">
                    <Link href="/load-notes" className="flex items-center text-muted-foreground hover:text-foreground mb-2">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Torna alle Note
                    </Link>
                    <h1 className="text-2xl font-bold">Nuova Nota di Carico</h1>
                    <p className="text-muted-foreground text-sm">
                        Inserisci il materiale prelevato. Non scarica il magazzino.
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Dettagli generali */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Dettagli Generali</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Data</Label>
                                <Input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center">
                                    Tipo Nota
                                    <FieldTip text="Uscita: materiale che esce verso il cantiere. Reso: materiale che torna indietro." />
                                </Label>
                                <div className="flex gap-1">
                                    <Button
                                        type="button"
                                        variant={noteType === 'uscita' ? 'default' : 'outline'}
                                        size="sm"
                                        className={`h-8 px-3 text-xs ${noteType === 'uscita' ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                                        onClick={() => setNoteType('uscita')}
                                    >
                                        <ArrowUpRight className="h-3 w-3 mr-1" />
                                        Uscita
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={noteType === 'reso' ? 'default' : 'outline'}
                                        size="sm"
                                        className={`h-8 px-3 text-xs ${noteType === 'reso' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                        onClick={() => setNoteType('reso')}
                                    >
                                        <ArrowDownRight className="h-3 w-3 mr-1" />
                                        Reso
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center">
                                    Commessa {!notes && <span className="text-destructive text-xs">*</span>}
                                    <FieldTip text="Basta compilare Commessa o Note, non servono entrambi." />
                                </Label>
                                <div
                                    className="flex items-center justify-between border rounded-md px-3 py-2 cursor-pointer hover:bg-muted h-10"
                                    onClick={() => setIsJobSelectorOpen(true)}
                                >
                                    {selectedJob ? (
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="font-medium text-sm truncate">{selectedJob.code}</span>
                                            <span className="text-[10px] text-muted-foreground truncate">{selectedJob.name}</span>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-muted-foreground">Seleziona commessa...</span>
                                    )}
                                    <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                </div>
                            </div>

                            <div className="space-y-2 md:col-span-3">
                                <Label>Note / Appunti {!selectedJob && <span className="text-destructive text-xs">*</span>}</Label>
                                <Textarea
                                    placeholder="Note libere..."
                                    className="h-24 resize-none"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                />
                                {!isValid && (
                                    <p className="text-[10px] text-destructive">
                                        * Compila almeno una Commessa o le Note
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Lista Materiali */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Lista Materiali</CardTitle>
                            <CardDescription>Clicca su una riga per selezionare il materiale, poi inserisci pezzi o quantità</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-6 sm:pt-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Materiale</TableHead>
                                            <TableHead className="w-[90px] text-center">
                                                <span className="inline-flex items-center justify-center w-full">
                                                    Pezzi
                                                    <FieldTip text="Collegato alla Quantità dal coefficiente dell'articolo: modificando uno dei due campi, l'altro si ricalcola automaticamente." />
                                                </span>
                                            </TableHead>
                                            <TableHead className="w-[110px] text-center">Quantità</TableHead>
                                            <TableHead className="w-[44px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {lines.map((line, index) => {
                                            const isLast = index === lines.length - 1;
                                            return (
                                                <TableRow key={line.tempId} className="group">
                                                    {/* Materiale */}
                                                    <TableCell
                                                        className="cursor-pointer select-none py-2"
                                                        onClick={() => openItemSelector(line.tempId)}
                                                    >
                                                        {line.itemId ? (
                                                            <div className="space-y-0.5">
                                                                <div className="font-mono text-[10px] text-muted-foreground leading-none">{line.itemCode}</div>
                                                                <div className="font-medium text-sm leading-tight">{line.itemName}</div>
                                                                {line.itemModel && (
                                                                    <div className="text-xs text-muted-foreground leading-none">{line.itemModel}</div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 text-muted-foreground py-1">
                                                                <Search className="h-4 w-4 shrink-0" />
                                                                <span className="text-sm">Cerca materiale...</span>
                                                            </div>
                                                        )}
                                                    </TableCell>

                                                    {/* Pezzi */}
                                                    <TableCell className="py-2 px-1">
                                                        <Input
                                                            type="number"
                                                            inputMode="decimal"
                                                            min="0"
                                                            step="0.01"
                                                            value={line.pieces}
                                                            onChange={e => handleLinePiecesChange(line.tempId, e.target.value)}
                                                            placeholder="0"
                                                            className="h-9 text-center px-1"
                                                            disabled={!line.itemId}
                                                        />
                                                    </TableCell>

                                                    {/* Quantità */}
                                                    <TableCell className="py-2 px-1">
                                                        <div className="flex items-center gap-1">
                                                            <Input
                                                                type="number"
                                                                inputMode="decimal"
                                                                min="0"
                                                                step="0.01"
                                                                value={line.quantity}
                                                                onChange={e => handleLineQuantityChange(line.tempId, e.target.value)}
                                                                placeholder="0.00"
                                                                className="h-9 text-center px-1"
                                                                disabled={!line.itemId}
                                                            />
                                                            <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">{line.unit}</span>
                                                        </div>
                                                    </TableCell>

                                                    {/* Elimina */}
                                                    <TableCell className="py-2 px-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeLine(line.tempId)}
                                                            className={`h-8 w-8 transition-opacity ${isLast && !line.itemId ? 'opacity-0 pointer-events-none' : 'text-destructive hover:bg-destructive/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100'}`}
                                                            tabIndex={-1}
                                                        >
                                                            <Trash className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-4">
                        <Link href="/load-notes">
                            <Button variant="outline" type="button">Annulla</Button>
                        </Link>
                        <Button onClick={handleSave} disabled={!isValid || isLoading} className="w-32">
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Salva</>}
                        </Button>
                    </div>
                </div>
            </div>

            <ItemSelectorDialog
                open={isItemSelectorOpen}
                onOpenChange={setIsItemSelectorOpen}
                onSelect={handleItemSelect}
                items={inventory}
                onSearch={handleItemSearch}
                loading={itemsLoading}
            />

            <JobSelectorDialog
                open={isJobSelectorOpen}
                onOpenChange={setIsJobSelectorOpen}
                onSelect={handleJobSelect}
                jobs={jobs}
                onSearch={handleJobSearch}
                loading={jobsLoading}
            />
        </DashboardLayout>
    );
}
