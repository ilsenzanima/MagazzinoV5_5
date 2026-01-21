"use client"

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Edit, Trash2, Archive, RotateCcw, Loader2, Package, CheckCircle2, User } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LoadNote } from "@/lib/types";
import { loadNotesService } from "@/lib/services/load-notes";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

export default function LoadNoteDetailPage() {
    const params = useParams();
    const router = useRouter();
    const noteId = params.id as string;

    const [note, setNote] = useState<LoadNote | null>(null);
    const [loading, setLoading] = useState(true);
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchNote();
    }, [noteId]);

    const fetchNote = async () => {
        setLoading(true);
        try {
            const data = await loadNotesService.getById(noteId);
            if (data) {
                setNote(data);
                // Pre-populate checked items from server
                const checked = new Set(data.items.filter(i => i.isChecked).map(i => i.id));
                setCheckedItems(checked);
            }
        } catch (error) {
            toast.error("Errore nel caricamento della nota");
        } finally {
            setLoading(false);
        }
    };

    const toggleCheck = (itemId: string) => {
        const next = new Set(checkedItems);
        if (next.has(itemId)) {
            next.delete(itemId);
        } else {
            next.add(itemId);
        }
        setCheckedItems(next);
    };

    const handleDelete = async () => {
        if (!confirm("Sei sicuro di voler eliminare questa nota?")) return;
        try {
            await loadNotesService.delete(noteId);
            toast.success("Nota eliminata");
            router.push("/load-notes");
        } catch (error) {
            toast.error("Errore eliminazione");
        }
    };

    const handleToggleStatus = async () => {
        if (!note) return;
        try {
            await loadNotesService.toggleStatus(noteId, note.status);
            toast.success(note.status === 'pending' ? "Nota archiviata" : "Nota riaperta");
            fetchNote(); // Refresh
        } catch (error) {
            toast.error("Impossibile aggiornare lo stato");
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    if (!note) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-full py-20">
                    <h2 className="text-xl font-bold mb-2">Nota non trovata</h2>
                    <p className="text-muted-foreground mb-6">La nota richiesta non esiste.</p>
                    <Link href="/load-notes">
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Torna alle Note
                        </Button>
                    </Link>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-3xl mx-auto pb-10">
                {/* Header */}
                <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <Link href="/load-notes" className="flex items-center text-muted-foreground hover:text-foreground mb-2">
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Torna alle Note
                        </Link>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            Dettaglio Nota
                            {note.status === 'pending' ? (
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                                    DA PROCESSARE
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    COMPLETATA
                                </Badge>
                            )}
                        </h1>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <Link href={`/load-notes/${noteId}/edit`}>
                            <Button variant="outline" size="sm">
                                <Edit className="mr-2 h-4 w-4" />
                                Modifica
                            </Button>
                        </Link>
                        <Button variant="outline" size="sm" onClick={handleToggleStatus}>
                            {note.status === 'pending' ? (
                                <><Archive className="mr-2 h-4 w-4" /> Archivia</>
                            ) : (
                                <><RotateCcw className="mr-2 h-4 w-4" /> Riapri</>
                            )}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleDelete}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Elimina
                        </Button>
                    </div>
                </div>

                {/* Info Card */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-base">Informazioni Generali</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Data:</span>
                            <span className="ml-2 font-medium">{format(new Date(note.date), "d MMMM yyyy", { locale: it })}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Commessa:</span>
                            {note.jobDescription ? (
                                <span className="ml-2 font-medium">{note.jobDescription}</span>
                            ) : (
                                <span className="ml-2 text-muted-foreground italic">Nessuna commessa</span>
                            )}
                        </div>
                        <div className="flex items-center">
                            <User className="h-4 w-4 text-muted-foreground mr-1" />
                            <span className="text-muted-foreground">Creata da:</span>
                            <span className="ml-2 font-medium">{note.createdByName || 'Sconosciuto'}</span>
                        </div>
                        {note.notes && (
                            <div className="md:col-span-2">
                                <span className="text-muted-foreground">Note:</span>
                                <p className="mt-1 p-3 bg-muted/30 rounded border-l-2 border-primary/20 italic">
                                    {note.notes}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Materials Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Materiali ({note.items.length})
                        </CardTitle>
                        <CardDescription>Spunta gli articoli già processati per tenerli traccia</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {note.items.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Nessun materiale in questa nota.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40px]"></TableHead>
                                        <TableHead>Articolo</TableHead>
                                        <TableHead className="text-center">Pezzi</TableHead>
                                        <TableHead className="text-right">Quantità</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {note.items.map(item => {
                                        const isChecked = checkedItems.has(item.id);
                                        return (
                                            <TableRow key={item.id} className={isChecked ? 'bg-muted/30' : ''}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={isChecked}
                                                        onCheckedChange={() => toggleCheck(item.id)}
                                                    />
                                                </TableCell>
                                                <TableCell className={isChecked ? 'line-through text-muted-foreground' : ''}>
                                                    <div className="font-medium">{item.inventoryName}</div>
                                                    {item.inventoryModel && (
                                                        <div className="text-xs text-muted-foreground">{item.inventoryModel}</div>
                                                    )}
                                                </TableCell>
                                                <TableCell className={`text-center ${isChecked ? 'text-muted-foreground' : ''}`}>
                                                    {item.pieces}
                                                </TableCell>
                                                <TableCell className={`text-right font-bold ${isChecked ? 'text-muted-foreground' : ''}`}>
                                                    {item.quantity} <span className="font-normal text-xs">{item.inventoryUnit}</span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
