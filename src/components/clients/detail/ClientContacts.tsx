"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Loader2, Mail, Phone, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { clientContactsApi, ClientContact } from "@/lib/services/client-contacts";
import { notify } from "@/lib/notify";

interface Props {
    clientId: string;
    canEdit: boolean;
}

const EMPTY_FORM = { name: "", role: "", phone: "", email: "", notes: "" };

export function ClientContacts({ clientId, canEdit }: Props) {
    const [contacts, setContacts] = useState<ClientContact[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [editing, setEditing] = useState<ClientContact | null>(null);
    const [toDelete, setToDelete] = useState<ClientContact | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);

    useEffect(() => { load(); }, [clientId]);

    const load = async () => {
        try {
            setLoading(true);
            setContacts(await clientContactsApi.getByClientId(clientId));
        } catch { notify.error("Errore caricamento contatti"); }
        finally { setLoading(false); }
    };

    const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); };
    const openEdit = (c: ClientContact) => {
        setEditing(c);
        setForm({ name: c.name, role: c.role, phone: c.phone, email: c.email, notes: c.notes });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) { notify.warning("Il nome è obbligatorio"); return; }
        try {
            setSaving(true);
            if (editing) {
                await clientContactsApi.update(editing.id, form);
            } else {
                await clientContactsApi.create(clientId, form);
            }
            setDialogOpen(false);
            await load();
        } catch { notify.error("Errore durante il salvataggio"); }
        finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        try {
            await clientContactsApi.delete(toDelete.id);
            setDeleteOpen(false);
            setToDelete(null);
            await load();
        } catch { notify.error("Errore durante l'eliminazione"); }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Rubrica Contatti</CardTitle>
                {canEdit && (
                    <Button size="sm" variant="outline" onClick={openNew}>
                        <Plus className="h-4 w-4 mr-1" /> Aggiungi
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
                ) : contacts.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">Nessun contatto aggiunto</p>
                ) : (
                    <div className="space-y-3">
                        {contacts.map(c => (
                            <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-muted/40 group">
                                <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-2 shrink-0">
                                    <UserRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{c.name}</span>
                                        {c.role && <span className="text-xs text-slate-500 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">{c.role}</span>}
                                    </div>
                                    <div className="mt-1 space-y-0.5 text-slate-500 dark:text-slate-400">
                                        {c.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" /><a href={`tel:${c.phone}`} className="hover:underline">{c.phone}</a></div>}
                                        {c.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 shrink-0" /><a href={`mailto:${c.email}`} className="hover:underline text-blue-600 dark:text-blue-400">{c.email}</a></div>}
                                        {c.notes && <p className="text-xs italic mt-1">{c.notes}</p>}
                                    </div>
                                </div>
                                {canEdit && (
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => { setToDelete(c); setDeleteOpen(true); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editing ? "Modifica Contatto" : "Nuovo Contatto"}</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1">
                            <Label>Nome e Cognome *</Label>
                            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Mario Rossi" />
                        </div>
                        <div className="space-y-1">
                            <Label>Ruolo / Qualifica</Label>
                            <Input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="Es. Responsabile acquisti" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label>Telefono</Label>
                                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+39 333 1234567" />
                            </div>
                            <div className="space-y-1">
                                <Label>Email</Label>
                                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="mario@esempio.it" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Note</Label>
                            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Disponibile solo al mattino..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Salva
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDeleteDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Elimina contatto"
                description={`Eliminare il contatto "${toDelete?.name}"?`}
                onConfirm={handleDelete}
            />
        </Card>
    );
}
