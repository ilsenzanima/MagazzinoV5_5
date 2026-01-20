"use client"

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash, Save, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { loadNotesService } from "@/lib/services/load-notes-mock";
import { Badge } from "@/components/ui/badge";

// Mock data for jobs
const MOCK_JOBS = [
    { value: "job-1", label: "2024-001 | Ristrutturazione Villa Rossi", description: "Via Roma 1" },
    { value: "job-2", label: "2024-002 | Nuovo Impianto Elettrico", description: "Via Milano 2" },
    { value: "job-3", label: "2024-003 | Manutenzione Condominio", description: "Piazza Verdi" },
];

// Mock data for inventory search
const MOCK_INVENTORY = [
    { id: "inv-1", name: "Tubo PVC Ø32", unit: "m", totalQuantity: 200, model: "Rigido" },
    { id: "inv-2", name: "Curva 90° PVC Ø32", unit: "pz", totalQuantity: 50, model: "A incollare" },
    { id: "inv-3", name: "Cavo FS17 1x2.5", unit: "m", totalQuantity: 500, model: "Blu" },
    { id: "inv-4", name: "Interruttore Bipolare", unit: "pz", totalQuantity: 20, model: "Living Now" },
];

export default function NewLoadNotePage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [jobId, setJobId] = useState("");
    const [notes, setNotes] = useState("");

    // Items State
    const [items, setItems] = useState<any[]>([]);

    // Item Add State
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [quantity, setQuantity] = useState("");
    const [searchItemTerm, setSearchItemTerm] = useState("");

    // Validation
    const isValid = jobId || notes.trim().length > 0;

    const handleAddItem = () => {
        if (!selectedItem || !quantity) return;

        const newItem = {
            id: Math.random().toString(36).substr(2, 9),
            inventoryId: selectedItem.id,
            inventoryName: selectedItem.name,
            inventoryUnit: selectedItem.unit,
            inventoryModel: selectedItem.model,
            quantity: parseFloat(quantity),
            inventoryCode: selectedItem.id // Mock code
        };

        setItems([...items, newItem]);

        // Reset Item Form
        setSelectedItem(null);
        setQuantity("");
        setSearchItemTerm("");
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    const handleSave = async () => {
        if (!isValid) {
            toast.error("Devi selezionare una commessa o inserire delle note.");
            return;
        }

        setIsLoading(true);
        try {
            const selectedJob = MOCK_JOBS.find(j => j.value === jobId);

            await loadNotesService.create({
                date,
                jobId: selectedJob?.value,
                jobCode: selectedJob?.label.split(' | ')[0],
                jobDescription: selectedJob?.label.split(' | ')[1],
                notes,
                items
            });

            toast.success("Nota creata con successo");
            router.push("/load-notes");
        } catch (error) {
            toast.error("Errore durante il salvataggio");
        } finally {
            setIsLoading(false);
        }
    };

    // Filtered inventory for search
    const filteredInventory = searchItemTerm
        ? MOCK_INVENTORY.filter(i =>
            i.name.toLowerCase().includes(searchItemTerm.toLowerCase()) ||
            i.model.toLowerCase().includes(searchItemTerm.toLowerCase())
        )
        : [];

    return (
        <DashboardLayout>
            <div className="flex flex-col space-y-6 max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 border-b pb-4">
                    <Link href="/load-notes">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Nuova Nota di Carico</h1>
                        <p className="text-muted-foreground text-sm">
                            Inserisci il materiale prelevato. Non scarica il magazzino.
                        </p>
                    </div>
                </div>

                {/* Main Form */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Testata (Left Column) */}
                    <div className="md:col-span-1 space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Dettagli Generali</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Data</Label>
                                    <Input
                                        type="date"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Commessa</Label>
                                    <SearchableSelect
                                        options={MOCK_JOBS}
                                        value={jobId}
                                        onValueChange={setJobId}
                                        placeholder="Seleziona commessa..."
                                    />
                                    {!jobId && !notes && (
                                        <p className="text-[10px] text-destructive">
                                            * Obbligatorio se mancano le note
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>Note / Appunti</Label>
                                    <Textarea
                                        placeholder="Note libere (es. 'Materiale per il bagno del piano terra')..."
                                        className="h-32 resize-none"
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                    />
                                    {!jobId && !notes && (
                                        <p className="text-[10px] text-destructive">
                                            * Obbligatorio se manca la commessa
                                        </p>
                                    )}
                                </div>

                                <Button
                                    className="w-full mt-4"
                                    onClick={handleSave}
                                    disabled={!isValid || isLoading}
                                >
                                    <Save className="mr-2 h-4 w-4" />
                                    Salva Nota
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Materiali (Right Column) */}
                    <div className="md:col-span-2 space-y-4">
                        <Card className="h-full flex flex-col">
                            <CardHeader>
                                <CardTitle className="text-base">Lista Materiali</CardTitle>
                                <CardDescription>Cerca materiali e aggiungi quantità (Lotti non richiesti)</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col space-y-4">

                                {/* Add Item Box */}
                                <div className="p-4 bg-muted/50 rounded-lg space-y-4 border">
                                    <div className="space-y-2">
                                        <Label>Cerca Articolo</Label>
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Scrivi nome articolo..."
                                                className="pl-8"
                                                value={searchItemTerm}
                                                onChange={e => {
                                                    setSearchItemTerm(e.target.value);
                                                    setSelectedItem(null); // Reset selection on typing
                                                }}
                                            />
                                        </div>
                                        {/* Dropdown Results Mock */}
                                        {searchItemTerm && !selectedItem && (
                                            <div className="absolute z-10 w-[calc(100%-4rem)] md:w-[calc(66%-4rem)] max-w-xl bg-popover border rounded-md shadow-md mt-1 overflow-hidden">
                                                {filteredInventory.length > 0 ? (
                                                    filteredInventory.map(item => (
                                                        <div
                                                            key={item.id}
                                                            className="p-2 hover:bg-accent cursor-pointer flex justify-between items-center text-sm"
                                                            onClick={() => {
                                                                setSelectedItem(item);
                                                                setSearchItemTerm(item.name);
                                                            }}
                                                        >
                                                            <div>
                                                                <div className="font-medium">{item.name}</div>
                                                                <div className="text-xs text-muted-foreground">{item.model}</div>
                                                            </div>
                                                            <div className="text-right text-xs">
                                                                <div>Disp: {item.totalQuantity} {item.unit}</div>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-2 text-sm text-muted-foreground">Nessun articolo trovato</div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {selectedItem && (
                                        <div className="flex items-end gap-3 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex-1">
                                                <Label className="text-xs text-muted-foreground">Articolo Selezionato</Label>
                                                <div className="font-medium text-sm flex items-center gap-2">
                                                    {selectedItem.name}
                                                    <Badge variant="outline" className="text-[10px]">{selectedItem.model}</Badge>
                                                </div>
                                            </div>
                                            <div className="w-24">
                                                <Label>Quantità</Label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        value={quantity}
                                                        onChange={e => setQuantity(e.target.value)}
                                                        placeholder="0"
                                                    />
                                                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
                                                        {selectedItem.unit}
                                                    </span>
                                                </div>
                                            </div>
                                            <Button onClick={handleAddItem} disabled={!quantity}>
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Items List */}
                                <div className="border rounded-md flex-1 overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Articolo</TableHead>
                                                <TableHead className="text-right">Qtà</TableHead>
                                                <TableHead className="w-[50px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {items.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                        Nessun materiale aggiunto
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                items.map(item => (
                                                    <TableRow key={item.id}>
                                                        <TableCell>
                                                            <div className="font-medium">{item.inventoryName}</div>
                                                            <div className="text-xs text-muted-foreground">{item.inventoryModel}</div>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold">
                                                            {item.quantity} <span className="text-muted-foreground text-xs font-normal">{item.inventoryUnit}</span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                                onClick={() => handleRemoveItem(item.id)}
                                                            >
                                                                <Trash className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>

                            </CardContent>
                        </Card>
                    </div>

                </div>
            </div>
        </DashboardLayout>
    );
}
