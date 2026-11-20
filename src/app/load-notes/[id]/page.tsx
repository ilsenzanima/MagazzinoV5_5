"use client"

import { useState, useEffect } from "react";
import { confirmDialog } from "@/components/ui/confirm-host";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { NotchTabs, NotchActions, NotchButton } from "@/components/ui/notch-tabs";
import { ActionsMenu } from "@/components/ui/actions-menu";
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
import { HelpTip } from "@/components/ui/help-tip";

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

    const toggleCheck = async (itemId: string, currentChecked: boolean) => {
        const next = new Set(checkedItems);
        if (currentChecked) {
            next.delete(itemId);
        } else {
            next.add(itemId);
        }
        setCheckedItems(next);
        try {
            await loadNotesService.toggleItemCheck(noteId, itemId, !currentChecked);
        } catch (error) {
            toast.error("Errore aggiornamento spunta");
        }
    };

    const handleDelete = async () => {
        if (!await confirmDialog("Sei sicuro di voler eliminare questa nota?")) return;
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
            <div className="w-full pb-10">
                {/* Header */}
                <div className="mb-6 space-y-2">
                    <Link href="/load-notes" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Note di carico
                    </Link>
                    <NotchTabs
                        title={
                            <span className="flex items-center gap-3">
                                Dettaglio Nota
                                {note.status === 'pending' ? (
                                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-yellow-800">DA PROCESSARE</span>
                                ) : (
                                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-green-700">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />COMPLETATA
                                    </span>
                                )}
                            </span>
                        }
                    >
                        <NotchActions>
                            <ActionsMenu items={[
                                { label: "Modifica", icon: <Edit />, href: `/load-notes/${noteId}/edit` },
                                note.status === 'pending'
                                    ? { label: "Archivia", icon: <Archive />, onClick: handleToggleStatus }
                                    : { label: "Riapri", icon: <RotateCcw />, onClick: handleToggleStatus },
                                { label: "Elimina", icon: <Trash2 />, onClick: handleDelete, danger: true },
                            ]} />
                        </NotchActions>
                    </NotchTabs>
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
                            <HelpTip
                                title="Materiali"
                                description="La spunta è solo un promemoria visivo: non scarica il magazzino né si collega automaticamente a un movimento. Se importi una riga in un Movimento dal dialog materiale, viene spuntata da sola, ma puoi comunque spuntarla o de-spuntarla manualmente in qualsiasi momento."
                            />
                        </CardTitle>
                        <CardDescription>Spunta gli articoli già processati per tenerli traccia</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {note.items.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Nessun materiale in questa nota.
                            </div>
                        ) : (
                            <>
                            {/* Telefono: una scheda per materiale, su più righe */}
                            <div className="space-y-3 md:hidden">
                                {note.items.map(item => {
                                    const isChecked = checkedItems.has(item.id);
                                    return (
                                        <div key={item.id} className={`rounded-lg border border-slate-200 p-3 dark:border-slate-700 ${isChecked ? 'bg-muted/30' : ''}`}>
                                            <div className="flex items-start gap-3">
                                                <Checkbox className="mt-1" checked={isChecked} onCheckedChange={() => toggleCheck(item.id, isChecked)} aria-label="Spunta riga" />
                                                <div className={`min-w-0 flex-1 ${isChecked ? 'text-muted-foreground line-through' : ''}`}>
                                                    {item.inventoryCode && <div className="font-mono text-[11px] text-muted-foreground">{item.inventoryCode}</div>}
                                                    <div className="break-words font-medium leading-tight">{item.inventoryName}</div>
                                                    {item.inventoryModel && <div className="break-words text-sm text-muted-foreground">{item.inventoryModel}</div>}
                                                </div>
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                                <div><div className="text-xs text-muted-foreground">Pezzi</div><div className="font-medium">{item.pieces ?? "—"}</div></div>
                                                <div><div className="text-xs text-muted-foreground">Quantità</div><div className="font-bold">{item.quantity} <span className="text-xs font-normal">{item.inventoryUnit}</span></div></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Tabella: da tablet in su */}
                            <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
                            <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                                <TableHeader>
                                    <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                                        <TableHead className="w-10 border-r"></TableHead>
                                        <TableHead className="border-r text-xs font-semibold uppercase tracking-wide text-slate-600">Articolo</TableHead>
                                        <TableHead className="w-28 border-r text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Pezzi</TableHead>
                                        <TableHead className="w-40 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Quantità</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {note.items.map(item => {
                                        const isChecked = checkedItems.has(item.id);
                                        return (
                                            <TableRow key={item.id} className={isChecked ? 'bg-muted/30' : ''}>
                                                <TableCell className="border-r py-2">
                                                    <Checkbox
                                                        checked={isChecked}
                                                        onCheckedChange={() => toggleCheck(item.id, isChecked)}
                                                        aria-label="Spunta riga"
                                                    />
                                                </TableCell>
                                                <TableCell className={`border-r py-2 ${isChecked ? 'line-through text-muted-foreground' : ''}`}>
                                                    {item.inventoryCode && <div className="font-mono text-[10px] leading-none text-muted-foreground">{item.inventoryCode}</div>}
                                                    <div className="text-sm font-medium leading-tight">{item.inventoryName}</div>
                                                    {item.inventoryModel && (
                                                        <div className="text-xs text-muted-foreground">{item.inventoryModel}</div>
                                                    )}
                                                </TableCell>
                                                <TableCell className={`border-r py-2 text-center text-sm ${isChecked ? 'text-muted-foreground' : 'text-slate-600 dark:text-slate-300'}`}>
                                                    {item.pieces ?? "—"}
                                                </TableCell>
                                                <TableCell className={`py-2 text-center text-sm font-bold ${isChecked ? 'text-muted-foreground' : ''}`}>
                                                    {item.quantity} <span className="font-normal text-xs">{item.inventoryUnit}</span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                            </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
