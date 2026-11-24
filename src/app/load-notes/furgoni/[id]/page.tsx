"use client"

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Archive, ArrowRightLeft, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { NotchTabs, NotchActions, NotchButton } from "@/components/ui/notch-tabs";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { confirmDialog } from "@/components/ui/confirm-host";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMobileActions } from "@/components/layout/mobile-actions";
import { FloatingAddButton } from "@/components/ui/floating-add-button";
import { NoteLineDialog, NoteLineResult } from "@/components/load-notes/NoteLineDialog";
import { MoveToNoteDialog } from "@/components/load-notes/MoveToNoteDialog";
import { inventoryApi, InventoryItem } from "@/lib/api";
import { vansService, Van } from "@/lib/services/vans";

// Il contesto del pannello «Azioni» esiste solo dentro DashboardLayout: la registrazione va fatta da un componente figlio
function SelectionMobileActions({ count, onMove, onRemove }: { count: number; onMove: () => void; onRemove: () => void }) {
    useMobileActions(count > 0 ? [
        { label: `Sposta su nota (${count})`, icon: <ArrowRightLeft className="h-5 w-5" />, onClick: onMove },
        { label: `Togli dal furgone (${count})`, icon: <Trash2 className="h-5 w-5" />, onClick: onRemove },
    ] : []);
    return null;
}

export default function VanDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [van, setVan] = useState<Van | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [name, setName] = useState("");
    const [plate, setPlate] = useState("");
    const [addOpen, setAddOpen] = useState(false);
    const [moveOpen, setMoveOpen] = useState(false);
    const [moveIds, setMoveIds] = useState<string[]>([]);
    // Dopo uno spostamento riuscito: nota che ha ricevuto il materiale (si sceglie se andarci o restare sul furgone)
    const [movedToNote, setMovedToNote] = useState<string | null>(null);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [continueAdd, setContinueAdd] = useState(false);

    const load = useCallback(async () => {
        try {
            const v = await vansService.getById(id);
            setVan(v);
            if (v) { setName(v.name); setPlate(v.plate || ""); }
        } catch {
            toast.error("Errore nel caricamento del furgone");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const searchItems = useCallback(async (term: string) => {
        setItemsLoading(true);
        try {
            const { items } = await inventoryApi.getPaginated({ page: 1, limit: 50, search: term });
            setInventory(items);
        } catch {
            toast.error("Errore nella ricerca dei materiali");
        } finally {
            setItemsLoading(false);
        }
    }, []);

    useEffect(() => { searchItems(""); }, [searchItems]);

    // «Aggiungi e continua»: il modale si riapre per il materiale successivo
    useEffect(() => {
        if (continueAdd) { setContinueAdd(false); setAddOpen(true); }
    }, [continueAdd]);

    const run = async (action: () => Promise<void>, error: string) => {
        try { await action(); await load(); } catch (e: any) { toast.error(e?.message || error); }
    };

    const saveDetails = () => {
        if (!van || !name.trim() || (name.trim() === van.name && plate.trim() === (van.plate || ""))) return;
        run(() => vansService.update(van.id, { name, plate }), "Impossibile salvare");
    };

    const addLine = ({ item, pieces, quantity }: NoteLineResult, next: boolean) => {
        setAddOpen(false);
        run(() => vansService.addItem(id, {
            inventoryId: item.id,
            quantity: parseFloat(quantity),
            pieces: parseFloat(pieces) || undefined,
            coefficient: item.coefficient ? Number(item.coefficient) : 1,
        }), "Impossibile aggiungere il materiale");
        if (next) setContinueAdd(true);
    };

    // Pezzi e quantità sono legati dal coefficiente dell'articolo: cambiando uno si ricalcola l'altro
    const saveAmounts = (item: Van["items"][number], field: "pieces" | "quantity", raw: string) => {
        const value = parseFloat(raw);
        if (!(value > 0) || value === (field === "pieces" ? item.pieces : item.quantity)) return;
        const coefficient = item.coefficient && item.coefficient > 0 ? item.coefficient : 1;
        const round = (n: number) => Math.round(n * 100) / 100;
        const pieces = field === "pieces" ? value : round(value / coefficient);
        const quantity = field === "quantity" ? value : round(value * coefficient);
        run(() => vansService.updateItem(item.id, { pieces, quantity }), "Impossibile salvare le quantità");
    };

    const toggle = (itemId: string) => setSelected(prev => {
        const next = new Set(prev);
        if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
        return next;
    });

    const removeSelected = async () => {
        if (selected.size === 0 || !await confirmDialog(`Togliere ${selected.size} righe dal furgone?`)) return;
        await run(() => vansService.removeItems([...selected]), "Impossibile togliere le righe");
        setSelected(new Set());
    };

    const deleteVan = async () => {
        if (!van) return;
        if (van.items.length > 0) { toast.error("Il furgone ha ancora del materiale: sposta o togli le righe, oppure archivialo"); return; }
        if (!await confirmDialog("Eliminare questo furgone?")) return;
        try { await vansService.delete(van.id); router.push("/load-notes?vista=furgoni"); } catch { toast.error("Impossibile eliminare il furgone"); }
    };

    if (loading) {
        return <DashboardLayout><div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
    }
    if (!van) {
        return <DashboardLayout><p className="py-12 text-center text-muted-foreground">Furgone non trovato</p></DashboardLayout>;
    }

    const someSelected = van.items.some(i => selected.has(i.id));
    const headCls = "border-r text-xs font-semibold uppercase tracking-wide text-slate-600";
    const allSelected = van.items.length > 0 && van.items.every(i => selected.has(i.id));

    return (
        <DashboardLayout>
            <div className="pb-10">
                <Link href="/load-notes?vista=furgoni" className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="mr-1 h-4 w-4" /> Torna ai furgoni
                </Link>
                <NotchTabs title={van.name}>
                    <NotchActions>
                        <ActionsMenu items={[
                            van.archived
                                ? { label: "Riattiva", icon: <RotateCcw />, onClick: () => run(() => vansService.update(van.id, { archived: !van.archived }), "Impossibile aggiornare") }
                                : { label: "Archivia", icon: <Archive />, onClick: () => run(() => vansService.update(van.id, { archived: !van.archived }), "Impossibile aggiornare") },
                            { label: "Elimina", icon: <Trash2 />, onClick: deleteVan, danger: true },
                        ]} />
                    </NotchActions>
                </NotchTabs>

                <div className="mt-6 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Furgone</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-1">
                                <Label htmlFor="v-name">Nome</Label>
                                <Input id="v-name" value={name} onChange={e => setName(e.target.value)} onBlur={saveDetails} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="v-plate">Targa</Label>
                                <Input id="v-plate" value={plate} onChange={e => setPlate(e.target.value)} onBlur={saveDetails} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                            <CardTitle>Materiale sul furgone ({van.items.length})</CardTitle>
                            <div className="hidden flex-wrap gap-2 md:flex">
                                {selected.size > 0 && (
                                    <>
                                        <Button variant="outline" size="sm" onClick={removeSelected}><Trash2 className="mr-1 h-4 w-4" /> Togli ({selected.size})</Button>
                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => { setMoveIds([...selected]); setMoveOpen(true); }}>
                                            <ArrowRightLeft className="mr-1 h-4 w-4" /> Sposta su nota ({selected.size})
                                        </Button>
                                    </>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {van.items.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">Il furgone è vuoto.</p>
                            ) : (
                                <>
                                {/* Telefono: una scheda per materiale, su più righe */}
                                <div className="space-y-3 md:hidden">
                                    {van.items.map(i => (
                                        <div key={i.id} className={`rounded-lg border border-slate-200 p-3 dark:border-slate-700 ${selected.has(i.id) ? "bg-muted/30" : ""}`}>
                                            <div className="flex items-start gap-3">
                                                <Checkbox className="mt-1" checked={selected.has(i.id)} onCheckedChange={() => toggle(i.id)} aria-label="Seleziona riga" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-mono text-[11px] text-muted-foreground">{i.inventoryCode}</div>
                                                    <div className="break-words font-medium leading-tight">{i.inventoryName}</div>
                                                    {i.inventoryModel && <div className="break-words text-sm text-muted-foreground">{i.inventoryModel}</div>}
                                                </div>
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Pezzi</Label>
                                                    <Input key={`m-${i.id}-p-${i.pieces}`} type="number" inputMode="decimal" min="0" step="0.01"
                                                        defaultValue={i.pieces ?? ""} className="h-10 text-center"
                                                        onBlur={e => saveAmounts(i, "pieces", e.target.value)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Quantità ({i.inventoryUnit})</Label>
                                                    <Input key={`m-${i.id}-q-${i.quantity}`} type="number" inputMode="decimal" min="0" step="0.01"
                                                        defaultValue={i.quantity} className="h-10 text-center"
                                                        onBlur={e => saveAmounts(i, "quantity", e.target.value)} />
                                                </div>
                                            </div>
                                            <Button size="sm" variant="outline" className="mt-3 w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                                                onClick={() => { setMoveIds([i.id]); setMoveOpen(true); }}>
                                                <ArrowRightLeft className="mr-1 h-4 w-4" /> Sposta su nota
                                            </Button>
                                        </div>
                                    ))}
                                </div>

                                <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
                                    <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                                        <TableHeader>
                                            <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                                                <TableHead className="w-10 border-r">
                                                    <Checkbox checked={allSelected ? true : someSelected ? "indeterminate" : false} aria-label="Seleziona tutte"
                                                        onCheckedChange={() => setSelected(allSelected ? new Set() : new Set(van.items.map(i => i.id)))} />
                                                </TableHead>
                                                <TableHead className={headCls}>Materiale</TableHead>
                                                <TableHead className={`w-28 text-center ${headCls}`}>Pezzi</TableHead>
                                                <TableHead className="w-40 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Quantità</TableHead>
                                                <TableHead className="w-32" />
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {van.items.map(i => (
                                                <TableRow key={i.id} className={selected.has(i.id) ? "bg-muted/30" : ""}>
                                                    <TableCell className="border-r py-2"><Checkbox checked={selected.has(i.id)} onCheckedChange={() => toggle(i.id)} aria-label="Seleziona riga" /></TableCell>
                                                    <TableCell className="border-r py-2">
                                                        <div className="font-mono text-[10px] leading-none text-muted-foreground">{i.inventoryCode}</div>
                                                        <div className="text-sm font-medium leading-tight">{i.inventoryName}</div>
                                                        {i.inventoryModel && <div className="text-xs text-muted-foreground">{i.inventoryModel}</div>}
                                                    </TableCell>
                                                    <TableCell className="border-r py-2 text-center text-sm text-slate-600 dark:text-slate-300"><Input key={`${i.id}-p-${i.pieces}`} type="number" inputMode="decimal" min="0" step="0.01"
                                                        defaultValue={i.pieces ?? ""} className="mx-auto h-8 w-20 px-1 text-center"
                                                        onBlur={e => saveAmounts(i, "pieces", e.target.value)} /></TableCell>
                                                    <TableCell className="py-2">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Input key={`${i.id}-q-${i.quantity}`} type="number" inputMode="decimal" min="0" step="0.01"
                                                                defaultValue={i.quantity} className="h-8 w-24 px-1 text-center"
                                                                onBlur={e => saveAmounts(i, "quantity", e.target.value)} />
                                                            <span className="text-[10px] text-muted-foreground">{i.inventoryUnit}</span>
                                                        </div>
                                                    </TableCell>
                                                <TableCell className="py-2 text-right">
                                                    <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                                        onClick={() => { setMoveIds([i.id]); setMoveOpen(true); }}>
                                                        <ArrowRightLeft className="mr-1 h-4 w-4" /> Sposta
                                                    </Button>
                                                </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <NoteLineDialog open={addOpen} onClose={() => setAddOpen(false)} items={inventory} onSearch={searchItems} loading={itemsLoading} onConfirm={addLine} />
            <MoveToNoteDialog open={moveOpen} onOpenChange={setMoveOpen} items={van.items.filter(i => moveIds.includes(i.id))}
                onMoved={(noteId) => { setSelected(new Set()); setMovedToNote(noteId); load(); }} />
            <Dialog open={!!movedToNote} onOpenChange={(open) => { if (!open) setMovedToNote(null); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Spostamento completato</DialogTitle>
                        <DialogDescription>Il materiale è sulla nota di carico. Vuoi aprire la nota o restare nel furgone per spostare altro?</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setMovedToNote(null)}>Resta nel furgone</Button>
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => router.push(`/load-notes/${movedToNote}`)}>Vai alla nota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <FloatingAddButton onClick={() => setAddOpen(true)} label="Aggiungi materiale" />
            <SelectionMobileActions count={selected.size} onMove={() => { setMoveIds([...selected]); setMoveOpen(true); }} onRemove={removeSelected} />
        </DashboardLayout>
    );
}
