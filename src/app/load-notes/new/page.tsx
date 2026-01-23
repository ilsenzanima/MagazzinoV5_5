"use client"

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash, Save, Search, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { loadNotesService } from "@/lib/services/load-notes";
import { ItemSelectorDialog } from "@/components/inventory/ItemSelectorDialog";
import { JobSelectorDialog } from "@/components/jobs/JobSelectorDialog";
import { inventoryApi, jobsApi, InventoryItem, Job } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";

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
    availableStock?: number;
}

export default function NewLoadNotePage() {
    const router = useRouter();
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

    // Items List State
    const [lines, setLines] = useState<NoteLine[]>([]);

    // Dialog States
    const [isJobSelectorOpen, setIsJobSelectorOpen] = useState(false);
    const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);

    // Validation: Job OR Notes required
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
            await loadNotesService.create({
                date,
                noteType,
                jobId: selectedJob?.id,
                notes,
                items: lines.map(l => ({
                    inventoryId: l.itemId,
                    quantity: l.quantity,
                    pieces: l.pieces
                }))
            });

            toast.success("Nota creata con successo");
            router.push("/load-notes");
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
            <div className="max-w-4xl mx-auto pb-10 overflow-hidden">
                {/* Header */}
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
                                <Label>Tipo Nota</Label>
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
                                <Label>Commessa {!notes && <span className="text-destructive text-xs">*</span>}</Label>
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
                                            <TableHead>Materiale</TableHead>
                                            <TableHead className="text-center w-[60px]">Pezzi</TableHead>
                                            <TableHead className="text-right w-[80px]">Q.tà</TableHead>
                                            {noteType === 'uscita' && (
                                                <>
                                                    <TableHead className="hidden sm:table-cell text-right w-[70px]">Giacenza</TableHead>
                                                    <TableHead className="hidden sm:table-cell text-right w-[80px]">Da Ord.</TableHead>
                                                </>
                                            )}
                                            <TableHead className="w-[40px]"></TableHead>
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
                                                            <div className="font-medium text-sm truncate max-w-[150px] sm:max-w-none">
                                                                {line.itemName}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground font-mono truncate">{line.itemCode}</div>
                                                        </TableCell>
                                                        <TableCell className="text-center font-medium">
                                                            {line.pieces}
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-sm">
                                                            {line.quantity} <span className="text-muted-foreground text-xs font-normal">{line.unit}</span>
                                                        </TableCell>
                                                        {noteType === 'uscita' && (
                                                            <>
                                                                <TableCell className={`hidden sm:table-cell text-right ${line.availableStock !== undefined && line.availableStock < line.quantity ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                                                    {line.availableStock !== undefined ? line.availableStock : '-'}
                                                                </TableCell>
                                                                <TableCell className="hidden sm:table-cell text-right">
                                                                    {shortage > 0 ? (
                                                                        <span className="text-destructive font-bold">+{shortage}</span>
                                                                    ) : (
                                                                        <span className="text-green-600">✓</span>
                                                                    )}
                                                                </TableCell>
                                                            </>
                                                        )}
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => removeLine(line.tempId)}
                                                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                                                            >
                                                                <Trash className="h-4 w-4" />
                                                            </Button>
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
