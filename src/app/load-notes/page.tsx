"use client"

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
    Clock,
    Trash2,
    Archive,
    RotateCcw,
    User,
    ArrowUpRight,
    ArrowDownRight
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LoadNote } from "@/lib/types";
import { loadNotesService } from "@/lib/services/load-notes";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

export default function LoadNotesPage() {
    const router = useRouter();
    const [notes, setNotes] = useState<LoadNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
        e.preventDefault();
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
            fetchNotes();
        } catch (error) {
            toast.error("Impossibile aggiornare lo stato");
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Sei sicuro di voler eliminare ${selectedIds.size} nota${selectedIds.size > 1 ? 'e' : ''}?`)) return;

        try {
            await Promise.all([...selectedIds].map(id => loadNotesService.delete(id)));
            toast.success(`${selectedIds.size} nota${selectedIds.size > 1 ? 'e eliminate' : ' eliminata'}`);
            setSelectedIds(new Set());
            fetchNotes();
        } catch (error) {
            toast.error("Errore durante l'eliminazione");
        }
    };

    const pendingNotes = notes.filter(n => n.status === 'pending');
    const completedNotes = notes.filter(n => n.status !== 'pending');

    return (
        <DashboardLayout>
            <div className="flex flex-col space-y-6 overflow-x-hidden">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <div className="min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Note di Carico</h1>
                        <p className="text-muted-foreground text-sm truncate">
                            Gestisci gli appunti per il materiale prelevato
                        </p>
                    </div>
                    <Link href="/load-notes/new" className="shrink-0">
                        <Button size="sm" className="w-full sm:w-auto">
                            <Plus className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Nuova Nota</span>
                            <span className="sm:hidden">Nuova</span>
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

                <Tabs defaultValue="pending" className="w-full">
                    <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-4">
                        <TabsTrigger value="pending">
                            Da Processare
                            {pendingNotes.length > 0 && (
                                <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                                    {pendingNotes.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="completed">Completate</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle>Da Processare</CardTitle>
                                <CardDescription>
                                    Note che richiedono attenzione o scarico magazzino.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <NotesTable
                                    notes={pendingNotes}
                                    loading={loading}
                                    onDelete={handleDelete}
                                    onToggle={handleToggleStatus}
                                    router={router}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="completed">
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <CardTitle>Archivio Completate</CardTitle>
                                        <CardDescription>
                                            Storico delle note già processate.
                                        </CardDescription>
                                    </div>
                                    {selectedIds.size > 0 && (
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={handleBulkDelete}
                                            className="shrink-0"
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Elimina selezionate ({selectedIds.size})
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <NotesTable
                                    notes={completedNotes}
                                    loading={loading}
                                    onDelete={handleDelete}
                                    onToggle={handleToggleStatus}
                                    router={router}
                                    selectable
                                    selectedIds={selectedIds}
                                    onSelectionChange={setSelectedIds}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}

function NotesTable({
    notes,
    loading,
    onDelete,
    onToggle,
    router,
    selectable = false,
    selectedIds = new Set(),
    onSelectionChange,
}: {
    notes: LoadNote[],
    loading: boolean,
    onDelete: (id: string, e: React.MouseEvent) => void,
    onToggle: (id: string, status: string, e: React.MouseEvent) => void,
    router: any,
    selectable?: boolean,
    selectedIds?: Set<string>,
    onSelectionChange?: (ids: Set<string>) => void,
}) {
    const allSelected = notes.length > 0 && notes.every(n => selectedIds.has(n.id));
    const someSelected = notes.some(n => selectedIds.has(n.id));

    const toggleOne = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onSelectionChange?.(next);
    };

    const toggleAll = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (allSelected) {
            const next = new Set(selectedIds);
            notes.forEach(n => next.delete(n.id));
            onSelectionChange?.(next);
        } else {
            const next = new Set(selectedIds);
            notes.forEach(n => next.add(n.id));
            onSelectionChange?.(next);
        }
    };

    if (loading) {
        return <div className="text-center py-8 text-muted-foreground">Caricamento...</div>;
    }

    if (notes.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                Nessuna nota in questo elenco.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto -mx-2 px-2">
            <Table>
                <TableHeader>
                    <TableRow>
                        {selectable && (
                            <TableHead className="w-[40px]" onClick={toggleAll}>
                                <Checkbox
                                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                                    aria-label="Seleziona tutte"
                                    className="cursor-pointer"
                                />
                            </TableHead>
                        )}
                        <TableHead className="w-[40px] sm:w-[100px]">Stato</TableHead>
                        <TableHead className="hidden sm:table-cell w-[100px]">Data</TableHead>
                        <TableHead>Commessa / Note</TableHead>
                        <TableHead className="hidden md:table-cell w-[120px]">Autore</TableHead>
                        <TableHead className="text-right w-[70px] sm:w-[80px]">Azioni</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {notes.map((note) => (
                        <TableRow
                            key={note.id}
                            className={`group cursor-pointer hover:bg-muted/50 ${selectable && selectedIds.has(note.id) ? 'bg-muted/30' : ''}`}
                            onClick={() => router.push(`/load-notes/${note.id}`)}
                        >
                            {selectable && (
                                <TableCell onClick={(e) => toggleOne(note.id, e)}>
                                    <Checkbox
                                        checked={selectedIds.has(note.id)}
                                        aria-label="Seleziona nota"
                                        className="cursor-pointer"
                                    />
                                </TableCell>
                            )}
                            <TableCell>
                                {note.status === 'pending' ? (
                                    <>
                                        <span className="sm:hidden" title="Da processare">
                                            <Clock className="h-5 w-5 text-yellow-600" />
                                        </span>
                                        <Badge variant="secondary" className="hidden sm:inline-flex bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200">
                                            DA PROCESSARE
                                        </Badge>
                                    </>
                                ) : (
                                    <>
                                        <span className="sm:hidden" title="Completata">
                                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                                        </span>
                                        <Badge variant="outline" className="hidden sm:inline-flex text-green-600 border-green-200 bg-green-50">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            COMPLETATA
                                        </Badge>
                                    </>
                                )}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell font-medium whitespace-nowrap">
                                {format(new Date(note.date), "dd MMM yyyy", { locale: it })}
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-0.5">
                                    <span className="sm:hidden text-[10px] text-muted-foreground">
                                        {format(new Date(note.date), "dd/MM/yy", { locale: it })}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <span title={note.noteType === 'reso' ? 'Reso' : 'Uscita'}>
                                            {note.noteType === 'reso' ? (
                                                <ArrowDownRight className="h-4 w-4 text-green-600 shrink-0" />
                                            ) : (
                                                <ArrowUpRight className="h-4 w-4 text-amber-600 shrink-0" />
                                            )}
                                        </span>
                                        {note.jobCode ? (
                                            <span className="text-sm font-medium break-words sm:truncate sm:max-w-[220px]" title={note.jobDescription}>
                                                {note.jobDescription || note.jobCode}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground italic text-sm">Nessuna commessa</span>
                                        )}
                                    </div>
                                    {note.notes && (
                                        <span className="text-xs text-muted-foreground break-words sm:line-clamp-2 pl-5">
                                            {note.notes}
                                        </span>
                                    )}
                                    {note.items.length > 0 && (
                                        <span className="hidden sm:flex items-center text-[10px] text-muted-foreground pl-5">
                                            <Package className="h-3 w-3 mr-1" />
                                            {note.items.length} articoli
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <User className="h-3 w-3" />
                                    <span className="truncate max-w-[100px]">{note.createdByName || '-'}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => onToggle(note.id, note.status, e)}
                                        title={note.status === 'pending' ? "Segna come completata" : "Riapri nota"}
                                    >
                                        {note.status === 'pending' ? (
                                            <Archive className="h-4 w-4 text-green-600" />
                                        ) : (
                                            <RotateCcw className="h-4 w-4 text-orange-500" />
                                        )}
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={(e) => onDelete(note.id, e)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
