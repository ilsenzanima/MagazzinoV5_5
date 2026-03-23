"use client"

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash, Save, Search, Loader2, X, AlertTriangle, Pencil, Check } from "lucide-react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { loadNotesService } from "@/lib/services/load-notes";
import { ItemSelectorDialog } from "@/components/inventory/ItemSelectorDialog";
import { JobSelectorDialog } from "@/components/jobs/JobSelectorDialog";
import { inventoryApi, jobsApi, InventoryItem, Job } from "@/lib/api";
import { LoadNote, LoadNoteItem } from "@/lib/types";

interface NoteLine {
    tempId: string;
    itemId: string;
    itemName: string;
    itemModel?: string;
    itemCode?: string;
    pieces: number;
    quantity: number;
    coefficient: number;
    unit: string;
    isChecked?: boolean;
    availableStock?: number; // Stock disponibile
}

export default function EditLoadNotePage() {
    const params = useParams();
    const router = useRouter();
    const noteId = params.id as string;

    const [isLoading, setIsLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [jobsLoading, setJobsLoading] = useState(false);

    // Data Sources
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);

    // Form State - Header
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [noteType, setNoteType] = useState<'uscita' | 'reso'>('uscita');
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [notes, setNotes] = useState("");

    // Form State - Current Line
    const [selectedItemForLine, setSelectedItemForLine] = useState<InventoryItem | null>(null);
    const [currentLine, setCurrentLine] = useState({
        pieces: "",
        quantity: "",
        coefficient: 1,
        unit: "PZ"
    });

    // Edit Item State
    const [editingLineId, setEditingLineId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<{ pieces: string, quantity: string }>({ pieces: "", quantity: "" });

    // Items List State
    const [lines, setLines] = useState<NoteLine[]>([]);

    // Dialog States
    const [isJobSelectorOpen, setIsJobSelectorOpen] = useState(false);
    const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);

    // Validation: Job OR Notes required
    const isValid = selectedJob || notes.trim().length > 0;

    useEffect(() => {
        loadData();
    }, [noteId]);

    const loadData = async () => {
        try {
            setInitialLoading(true);

            // Load note data
            const noteData = await loadNotesService.getById(noteId);
            if (noteData) {
                setDate(noteData.date);
                setNoteType(noteData.noteType);
                setNotes(noteData.notes || "");

                // Convert items to NoteLine format
                const existingLines: NoteLine[] = noteData.items.map(item => ({
                    tempId: item.id,
                    itemId: item.inventoryId,
                    itemName: item.inventoryName,
                    itemModel: item.inventoryModel,
                    itemCode: item.inventoryCode,
                    pieces: item.pieces || item.quantity,
                    quantity: item.quantity,
                    coefficient: item.coefficient || 1,
                    unit: item.inventoryUnit || "PZ",
                    isChecked: item.isChecked,
                    availableStock: undefined // Will be loaded
                }));
                setLines(existingLines);

                // Load job if exists
                if (noteData.jobId) {
                    // Try to find job in list or set basic info
                    setSelectedJob({
                        id: noteData.jobId,
                        code: noteData.jobCode || "",
                        name: noteData.jobDescription || ""
                    } as Job);
                }
            }

            // Load inventory and jobs
            const [inventoryData, jobsData] = await Promise.all([
                inventoryApi.getPaginated({ page: 1, limit: 50 }),
                jobsApi.getPaginated({ page: 1, limit: 50, status: 'active' })
            ]);
            setInventory(inventoryData.items);
            setJobs(jobsData.data);
        } catch (error) {
            console.error("Failed to load data", error);
            toast.error("Errore nel caricamento della nota");
        } finally {
            setInitialLoading(false);
        }
    };

    const handleItemSearch = useCallback(async (term: string) => {
        setItemsLoading(true);
        try {
            const { items } = await inventoryApi.getPaginated({
                page: 1,
                limit: 50,
                search: term
            });
            setInventory(items);
        } catch (error) {
            console.error("Failed to search items", error);
        } finally {
            setItemsLoading(false);
        }
    }, []);

    const handleJobSearch = useCallback(async (term: string) => {
        setJobsLoading(true);
        try {
            const { data } = await jobsApi.getPaginated({
                page: 1,
                limit: 50,
                search: term,
                status: 'active'
            });
            setJobs(data);
        } catch (error) {
            console.error("Failed to search jobs", error);
        } finally {
            setJobsLoading(false);
        }
    }, []);

    const handleItemSelect = (item: InventoryItem) => {
        setSelectedItemForLine(item);
        setCurrentLine({
            pieces: "",
            quantity: "",
            coefficient: item.coefficient ? Number(item.coefficient) : 1,
            unit: item.unit || 'PZ'
        });
        setIsItemSelectorOpen(false);
    };

    const handleJobSelect = (job: Job) => {
        setSelectedJob(job);
        setIsJobSelectorOpen(false);
    };

    const handleCurrentLinePiecesChange = (piecesStr: string) => {
        const pieces = parseFloat(piecesStr);
        if (isNaN(pieces)) {
            setCurrentLine(prev => ({ ...prev, pieces: piecesStr, quantity: "" }));
            return;
        }
        const quantity = (pieces * currentLine.coefficient).toFixed(2);
        setCurrentLine(prev => ({
            ...prev,
            pieces: piecesStr,
            quantity: quantity
        }));
    };

    const handleCurrentLineQuantityChange = (quantityStr: string) => {
        const quantity = parseFloat(quantityStr);
        if (isNaN(quantity)) {
            setCurrentLine(prev => ({ ...prev, quantity: quantityStr, pieces: "" }));
            return;
        }
        let piecesStr = currentLine.pieces;
        if (currentLine.coefficient && currentLine.coefficient !== 1) {
            piecesStr = (quantity / currentLine.coefficient).toFixed(2);
        } else {
            piecesStr = quantity.toString();
        }
        setCurrentLine(prev => ({
            ...prev,
            quantity: quantityStr,
            pieces: piecesStr
        }));
    };

    const handleAddLine = () => {
        if (!selectedItemForLine || !currentLine.quantity) {
            toast.warning("Seleziona un articolo e inserisci la quantità");
            return;
        }

        const existingLine = lines.find(l => l.itemId === selectedItemForLine.id);
        if (existingLine) {
            const confirmNew = confirm(`L'articolo "${selectedItemForLine.name}" è già presente nella lista.\n\nVuoi aggiungerlo come NUOVA voce separata?\n(Annulla per non aggiungere nulla e modificare la voce esistente)`);
            if (!confirmNew) {
                return;
            }
        }

        const newLine: NoteLine = {
            tempId: Math.random().toString(36).substr(2, 9),
            itemId: selectedItemForLine.id,
            itemName: selectedItemForLine.name,
            itemModel: selectedItemForLine.model,
            itemCode: selectedItemForLine.code,
            pieces: parseFloat(currentLine.pieces) || parseFloat(currentLine.quantity),
            quantity: parseFloat(currentLine.quantity),
            coefficient: currentLine.coefficient,
            unit: currentLine.unit,
            isChecked: false,
            availableStock: selectedItemForLine.quantity
        };

        setLines([...lines, newLine]);

        // Reset current line
        setCurrentLine({ pieces: "", quantity: "", coefficient: 1, unit: "PZ" });
        setSelectedItemForLine(null);
    };

    const startEditing = (line: NoteLine) => {
        setEditingLineId(line.tempId);
        setEditValues({
            pieces: line.pieces.toString(),
            quantity: line.quantity.toString()
        });
    };

    const cancelEdit = () => {
        setEditingLineId(null);
        setEditValues({ pieces: "", quantity: "" });
    };

    const saveEdit = (tempId: string, coefficient: number) => {
        const newPieces = parseFloat(editValues.pieces);
        const newQuantity = parseFloat(editValues.quantity);

        if (isNaN(newQuantity) || newQuantity <= 0) {
            toast.error("Inserisci una quantità valida");
            return;
        }

        setLines(lines.map(line => {
            if (line.tempId === tempId) {
                return {
                    ...line,
                    pieces: !isNaN(newPieces) ? newPieces : newQuantity, // Fallback if no pieces logic
                    quantity: newQuantity
                };
            }
            return line;
        }));

        setEditingLineId(null);
    };

    const handleEditPiecesChange = (piecesStr: string, coefficient: number) => {
        const pieces = parseFloat(piecesStr);
        let quantityStr = editValues.quantity;

        if (!isNaN(pieces)) {
            quantityStr = (pieces * coefficient).toFixed(2);
        }

        setEditValues({
            pieces: piecesStr,
            quantity: quantityStr
        });
    };

    const handleEditQuantityChange = (quantityStr: string, coefficient: number) => {
        const quantity = parseFloat(quantityStr);
        let piecesStr = editValues.pieces;

        if (!isNaN(quantity)) {
            if (coefficient && coefficient !== 1) {
                piecesStr = (quantity / coefficient).toFixed(2);
            } else {
                piecesStr = quantity.toString();
            }
        }

        setEditValues({
            pieces: piecesStr,
            quantity: quantityStr
        });
    };

    const removeLine = (tempId: string) => {
        setLines(lines.filter(l => l.tempId !== tempId));
    };

    const handleSave = async () => {
        if (!isValid) {
            toast.error("Devi selezionare una commessa o inserire delle note.");
            return;
        }

        setIsLoading(true);
        try {
            await loadNotesService.update(noteId, {
                date,
                jobId: selectedJob?.id,
                notes,
                items: lines.map(l => ({
                    inventoryId: l.itemId,
                    quantity: l.quantity,
                    pieces: l.pieces,
                    coefficient: l.coefficient
                }))
            });

            toast.success("Nota aggiornata con successo");
            router.push(`/load-notes/${noteId}`);
        } catch (error) {
            toast.error("Errore durante il salvataggio");
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
            <div className="max-w-4xl mx-auto pb-10">
                {/* Header */}
                <div className="mb-6">
                    <Link href={`/load-notes/${noteId}`} className="flex items-center text-muted-foreground hover:text-foreground mb-2">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Torna al Dettaglio
                    </Link>
                    <h1 className="text-2xl font-bold">Modifica Nota di Carico</h1>
                    <p className="text-muted-foreground text-sm">
                        Modifica i dati della nota e i materiali.
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Header Data */}
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
                                <Label>Commessa {!notes && <span className="text-destructive text-xs">*</span>}</Label>
                                <div
                                    className="flex items-center justify-between border rounded-md px-3 py-2 cursor-pointer hover:bg-muted h-10"
                                    onClick={() => setIsJobSelectorOpen(true)}
                                >
                                    {selectedJob ? (
                                        <div className="flex flex-col overflow-hidden flex-1">
                                            <span className="font-medium text-sm truncate">{selectedJob.code}</span>
                                            <span className="text-[10px] text-muted-foreground truncate">{selectedJob.name}</span>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-muted-foreground">Seleziona commessa...</span>
                                    )}
                                    {selectedJob ? (
                                        <X
                                            className="h-4 w-4 text-muted-foreground hover:text-destructive flex-shrink-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedJob(null);
                                            }}
                                        />
                                    ) : (
                                        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2 md:col-span-3">
                                <Label>Note / Appunti {!selectedJob && <span className="text-destructive text-xs">*</span>}</Label>
                                <Textarea
                                    placeholder="Note libere (es. 'Materiale per il bagno del piano terra')..."
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

                    {/* Add Items Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Lista Materiali</CardTitle>
                            <CardDescription>Cerca materiali e aggiungi quantità</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Add Line Form */}
                            <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                    <div className="md:col-span-5 space-y-2">
                                        <Label>Materiale</Label>
                                        <div
                                            className="flex items-center justify-between bg-background border rounded-md px-3 py-2 cursor-pointer hover:bg-muted h-10"
                                            onClick={() => setIsItemSelectorOpen(true)}
                                        >
                                            {selectedItemForLine ? (
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <span className="font-mono text-xs font-bold bg-muted px-1 rounded">{selectedItemForLine.code}</span>
                                                    <span className="text-sm truncate">{selectedItemForLine.name}</span>
                                                    {selectedItemForLine.model && <span className="text-xs text-muted-foreground">({selectedItemForLine.model})</span>}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">Cerca articolo...</span>
                                            )}
                                            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                        </div>
                                        {selectedItemForLine && (
                                            <p className="text-xs text-muted-foreground">
                                                Giacenza: <span className={selectedItemForLine.quantity <= 0 ? 'text-destructive font-bold' : 'font-medium'}>{selectedItemForLine.quantity} {selectedItemForLine.unit}</span>
                                            </p>
                                        )}
                                    </div>

                                    <div className="md:col-span-2 space-y-2">
                                        <Label>Pezzi <span className="text-xs text-muted-foreground font-normal">(Coeff: {currentLine.coefficient})</span></Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={currentLine.pieces}
                                            onChange={(e) => handleCurrentLinePiecesChange(e.target.value)}
                                            placeholder="Pezzi"
                                        />
                                    </div>

                                    <div className="md:col-span-2 space-y-2">
                                        <Label>Quantità ({currentLine.unit})</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={currentLine.quantity}
                                            onChange={(e) => handleCurrentLineQuantityChange(e.target.value)}
                                            placeholder="0.00"
                                        />
                                    </div>

                                    <div className="md:col-span-3 flex items-end pb-px">
                                        <Button type="button" onClick={handleAddLine} className="w-full">
                                            <Plus className="mr-2 h-4 w-4" /> Aggiungi
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Lines Table */}
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[220px]">Materiale</TableHead>
                                            <TableHead className="text-center w-[80px]">Pezzi</TableHead>
                                            <TableHead className="text-right w-[100px]">Q.tà Tot.</TableHead>
                                            {noteType === 'uscita' && (
                                                <>
                                                    <TableHead className="text-right w-[80px]">Giacenza</TableHead>
                                                    <TableHead className="text-right w-[90px]">Da Ordinare</TableHead>
                                                </>
                                            )}
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {lines.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={noteType === 'uscita' ? 6 : 4} className="text-center py-8 text-muted-foreground">
                                                    Nessun materiale aggiunto
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            lines.map((line) => {
                                                const shortage = line.availableStock !== undefined
                                                    ? Math.max(0, line.quantity - line.availableStock)
                                                    : 0;
                                                return (
                                                    <TableRow key={line.tempId}>
                                                        <TableCell>
                                                            <div className="font-medium">
                                                                {line.itemName}
                                                                {line.itemModel && <span className="text-muted-foreground font-normal ml-1">({line.itemModel})</span>}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground font-mono">{line.itemCode}</div>
                                                        </TableCell>
                                                        <TableCell className="text-center font-medium">
                                                            {editingLineId === line.tempId ? (
                                                                <Input
                                                                    type="number"
                                                                    className="h-8 w-20 mx-auto text-center"
                                                                    value={editValues.pieces}
                                                                    onChange={(e) => handleEditPiecesChange(e.target.value, line.coefficient)}
                                                                />
                                                            ) : (
                                                                line.pieces
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold">
                                                            {editingLineId === line.tempId ? (
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <Input
                                                                        type="number"
                                                                        className="h-8 w-24 text-right"
                                                                        value={editValues.quantity}
                                                                        onChange={(e) => handleEditQuantityChange(e.target.value, line.coefficient)}
                                                                    />
                                                                    <span className="text-muted-foreground text-xs font-normal">{line.unit}</span>
                                                                </div>
                                                            ) : (
                                                                <>{line.quantity} <span className="text-muted-foreground text-xs font-normal">{line.unit}</span></>
                                                            )}
                                                        </TableCell>
                                                        {noteType === 'uscita' && (
                                                            <>
                                                                <TableCell className={`text-right ${line.availableStock !== undefined && line.availableStock < line.quantity ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                                                    {line.availableStock !== undefined ? line.availableStock : '-'}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    {shortage > 0 ? (
                                                                        <span className="text-destructive font-bold">+{shortage}</span>
                                                                    ) : (
                                                                        <span className="text-green-600">✓</span>
                                                                    )}
                                                                </TableCell>
                                                            </>
                                                        )}
                                                        <TableCell>
                                                            {editingLineId === line.tempId ? (
                                                                <div className="flex items-center gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => saveEdit(line.tempId, line.coefficient)}
                                                                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                                                                    >
                                                                        <Check className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={cancelEdit}
                                                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => startEditing(line)}
                                                                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => removeLine(line.tempId)}
                                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                                                                    >
                                                                        <Trash className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-4">
                        <Link href={`/load-notes/${noteId}`}>
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
