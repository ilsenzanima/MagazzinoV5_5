"use client"

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ListPageHeader } from "@/components/ui/list-page-header";
import { FloatingAddButton } from "@/components/ui/floating-add-button";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { vansService, Van } from "@/lib/services/vans";

const headCls = "border-r text-xs font-semibold uppercase tracking-wide text-slate-600";
const summary = (v: Van) => v.items.map(i => i.inventoryName).join(", ");

type Tabs = React.ComponentProps<typeof ListPageHeader>["tabs"];

// Tab «Furgoni» delle note di carico: un elenco permanente di materiale per ogni furgone
export function VansView({ tabs }: { tabs: Tabs }) {
    const router = useRouter();
    const [vans, setVans] = useState<Van[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showArchived, setShowArchived] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("");
    const [plate, setPlate] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        vansService.getAll().then(setVans).catch(() => toast.error("Errore nel caricamento dei furgoni")).finally(() => setLoading(false));
    }, []);

    const rows = useMemo(() => {
        const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
        return vans.filter(v => (showArchived || !v.archived) &&
            terms.every(t => [v.name, v.plate, ...v.items.map(i => i.inventoryName)].filter(Boolean).join(" ").toLowerCase().includes(t)));
    }, [vans, search, showArchived]);

    const create = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const id = await vansService.create({ name, plate });
            router.push(`/load-notes/furgoni/${id}`);
        } catch {
            toast.error("Impossibile creare il furgone");
            setSaving(false);
        }
    };

    return (
        <DashboardLayout>
            <ListPageHeader
                strip
                title="Note di Carico"
                tabs={tabs}
                search={{ id: "vans-search", label: "Cerca furgoni", value: search, onChange: setSearch, placeholder: "Cerca per furgone, targa o materiale..." }}
                searchActions={
                    <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs md:text-slate-200">
                        <Checkbox checked={showArchived} onCheckedChange={(v) => setShowArchived(v === true)} />
                        Mostra archiviati
                    </label>
                }
            />

            {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
            ) : rows.length === 0 ? (
                <div className="py-10 text-center text-slate-400 dark:text-slate-500">
                    <Truck className="mx-auto mb-2 h-12 w-12 opacity-20" />
                    <p>{vans.length === 0 ? "Nessun furgone: aggiungine uno con il pulsante +" : "Nessun furgone trovato"}</p>
                </div>
            ) : (
                <>
                    {/* Tabella: da tablet in su */}
                    <div className="mb-4 hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
                        <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                            <TableHeader>
                                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                                    <TableHead className={`w-64 ${headCls}`}>Furgone</TableHead>
                                    <TableHead className={`w-32 ${headCls}`}>Targa</TableHead>
                                    <TableHead className={headCls}>Materiale</TableHead>
                                    <TableHead className="w-24 text-xs font-semibold uppercase tracking-wide text-slate-600">Stato</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map(v => (
                                    <TableRow key={v.id} className="cursor-pointer" onClick={() => router.push(`/load-notes/furgoni/${v.id}`)}>
                                        <TableCell className="border-r py-2 text-sm font-medium">
                                            <span className="flex items-center gap-2"><Truck className="h-4 w-4 shrink-0 text-blue-600" /><span className="truncate">{v.name}</span></span>
                                        </TableCell>
                                        <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">{v.plate || "—"}</TableCell>
                                        <TableCell className="border-r py-2 text-xs text-slate-500 dark:text-slate-400">
                                            <div className="line-clamp-2" title={summary(v)}>{v.items.length === 0 ? <span className="text-slate-300">Vuoto</span> : `${v.items.length} articoli: ${summary(v)}`}</div>
                                        </TableCell>
                                        <TableCell className="py-2 text-xs text-slate-500">{v.archived ? "Archiviato" : "Attivo"}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Schede: telefono */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
                        {rows.map(v => (
                            <Card key={v.id} className="cursor-pointer border-slate-200 transition-shadow hover:shadow-md dark:border-slate-700" onClick={() => router.push(`/load-notes/furgoni/${v.id}`)}>
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-2">
                                        <Truck className="h-4 w-4 shrink-0 text-blue-600" />
                                        <span className="truncate font-medium">{v.name}</span>
                                        {v.archived && <span className="rounded bg-slate-100 px-1.5 text-[10px] uppercase text-slate-500">Archiviato</span>}
                                    </div>
                                    {v.plate && <p className="mt-0.5 text-xs text-slate-500">{v.plate}</p>}
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{v.items.length === 0 ? "Vuoto" : `${v.items.length} articoli: ${summary(v)}`}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </>
            )}

            <FloatingAddButton onClick={() => { setName(""); setPlate(""); setCreateOpen(true); }} label="Nuovo furgone" />

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Nuovo furgone</DialogTitle>
                        <DialogDescription>Un elenco di materiale che resta sul furgone finché non lo sposti su una nota di carico.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label htmlFor="van-name">Nome</Label>
                            <Input id="van-name" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Es. Ducato bianco" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="van-plate">Targa (facoltativa)</Label>
                            <Input id="van-plate" value={plate} onChange={e => setPlate(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
                        <Button className="bg-blue-600 hover:bg-blue-700" disabled={!name.trim() || saving} onClick={create}>Crea</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
