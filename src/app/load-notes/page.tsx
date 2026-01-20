"use client"

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Plus,
    Search,
    FileText,
    Package,
    CheckCircle2,
    Circle,
    Trash2,
    Archive,
    RotateCcw
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LoadNote } from "@/lib/types";
import { loadNotesService } from "@/lib/services/load-notes-mock";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export default function LoadNotesPage() {
    const [notes, setNotes] = useState<LoadNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchNotes = async () => {
        setLoading(true);
        try {
            const data = await loadNotesService.getAll({ search: searchTerm });
            setNotes(data);
        } catch (error) {
            toast.error("Errore nel caricamento delle note");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchNotes();
        }, 300); // Debounce search
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault(); // Prevent link navigation if inside a link (though here we use actions column)
        e.stopPropagation();

        if (!confirm("Sei sicuro di voler eliminare questa nota?")) return;

        try {
            await loadNotesService.delete(id);
            toast.success("Nota eliminata");
            fetchNotes();
        } catch (error) {
            toast.error("Errore eliminazione");
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        try {
            await loadNotesService.toggleStatus(id, currentStatus);
            toast.success(currentStatus === 'pending' ? "Nota archiviata" : "Nota riaperta");
            fetchNotes(); // Refresh list to update sort order
        } catch (error) {
            toast.error("Impossibile aggiornare lo stato");
        }
    };

    return (
        <DashboardLayout>
            <div className="flex flex-col space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Note di Carico</h1>
                        <p className="text-muted-foreground">
                            Gestisci gli appunti per il materiale prelevato dal magazzino
                        </p>
                    </div>
                    <Link href="/load-notes/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Nuova Nota
                        </Button>
                    </Link>
                </div>

                <div className="flex items-center space-x-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Cerca per commessa, note o materiale..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Elenco Note</CardTitle>
                        <CardDescription>
                            Le note non ancora prese in carico appaiono per prime.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
                        ) : notes.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Nessuna nota trovata.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px]">Stato</TableHead>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Commessa</TableHead>
                                        <TableHead>Note / Materiale</TableHead>
                                        <TableHead className="text-right">Azioni</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {notes.map((note) => (
                                        <TableRow key={note.id} className="group">
                                            <TableCell>
                                                {note.status === 'pending' ? (
                                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200">
                                                        DA PROCESSARE
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                        COMPLETATA
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {format(new Date(note.date), "dd MMM yyyy", { locale: it })}
                                            </TableCell>
                                            <TableCell>
                                                {note.jobCode ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-sm">{note.jobCode}</span>
                                                        <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={note.jobDescription}>
                                                            {note.jobDescription}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground italic">Nessuna commessa</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    {note.notes && (
                                                        <div className="flex items-start text-sm">
                                                            <FileText className="h-3 w-3 mr-1 mt-1 text-muted-foreground shrink-0" />
                                                            <span className="line-clamp-2">{note.notes}</span>
                                                        </div>
                                                    )}
                                                    {note.items.length > 0 && (
                                                        <div className="flex items-center text-xs text-muted-foreground">
                                                            <Package className="h-3 w-3 mr-1" />
                                                            {note.items.length} articoli: {note.items.map(i => i.inventoryName).join(", ").slice(0, 50)}...
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => handleToggleStatus(note.id, note.status, e)}
                                                        title={note.status === 'pending' ? "Segna come completata" : "Riapri nota"}
                                                    >
                                                        {note.status === 'pending' ? (
                                                            <Archive className="h-4 w-4 text-green-600" />
                                                        ) : (
                                                            <RotateCcw className="h-4 w-4 text-orange-500" />
                                                        )}
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={(e) => handleDelete(note.id, e)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
