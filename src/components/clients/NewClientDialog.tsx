"use client"

import { useEffect, useState } from "react";
import { notify } from "@/lib/notify";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { clientsApi, Client } from "@/lib/api";
import { DuplicateClientsNotice } from "@/components/clients/DuplicateClientsNotice";

const EMPTY_FORM = {
    name: "", street: "", streetNumber: "", postalCode: "", city: "", province: "",
    vatNumber: "", email: "", phone: "",
};

interface NewClientDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (client: Client) => void;
    initialName?: string;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</h3>;
}

// Creazione committente in un modale: usata dalla lista committenti, dalla nuova commessa e dalle offerte
export function NewClientDialog({ open, onOpenChange, onCreated, initialName }: NewClientDialogProps) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    // Ogni apertura riparte da un modulo vuoto (o dal nome che si stava scrivendo)
    useEffect(() => {
        if (open) setForm({ ...EMPTY_FORM, name: initialName?.trim() ?? "" });
    }, [open, initialName]);

    const set = (patch: Partial<typeof EMPTY_FORM>) => setForm(prev => ({ ...prev, ...patch }));

    const handleCreate = async () => {
        if (!form.name.trim()) { notify.warning("Il nome del committente è obbligatorio"); return; }
        try {
            setSaving(true);
            const created = await clientsApi.create({ ...form, name: form.name.trim() });
            notify.success("Committente creato");
            onOpenChange(false);
            onCreated(created);
        } catch (error) {
            console.error("Error creating client:", error);
            notify.error("Errore durante la creazione del committente");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Nuovo Committente</DialogTitle></DialogHeader>
                <form
                    onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
                    className="space-y-5 py-2"
                >
                    <div className="space-y-3">
                        <SectionTitle>Anagrafica</SectionTitle>
                        <div className="space-y-1">
                            <Label htmlFor="nc-name">Ragione sociale / Nome *</Label>
                            <Input id="nc-name" autoFocus value={form.name} onChange={e => set({ name: e.target.value })} placeholder="Inserisci il nome dell'azienda o del cliente" />
                        </div>
                        <DuplicateClientsNotice
                            name={form.name}
                            vatNumber={form.vatNumber}
                            street={form.street}
                            streetNumber={form.streetNumber}
                            postalCode={form.postalCode}
                            city={form.city}
                        />
                        <div className="space-y-1">
                            <Label htmlFor="nc-vat">Partita IVA / Codice fiscale</Label>
                            <Input id="nc-vat" value={form.vatNumber} onChange={e => set({ vatNumber: e.target.value })} />
                        </div>
                    </div>

                    <div className="space-y-3 border-t pt-4">
                        <SectionTitle>Indirizzo sede</SectionTitle>
                        <div className="grid grid-cols-4 gap-3">
                            <div className="col-span-3 space-y-1">
                                <Label htmlFor="nc-street">Via / Piazza</Label>
                                <Input id="nc-street" value={form.street} onChange={e => set({ street: e.target.value })} placeholder="Via Roma" />
                            </div>
                            <div className="col-span-1 space-y-1">
                                <Label htmlFor="nc-number">N. civico</Label>
                                <Input id="nc-number" value={form.streetNumber} onChange={e => set({ streetNumber: e.target.value })} placeholder="10" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="nc-cap">CAP</Label>
                                <Input id="nc-cap" value={form.postalCode} onChange={e => set({ postalCode: e.target.value })} placeholder="00100" />
                            </div>
                            <div className="md:col-span-2 space-y-1">
                                <Label htmlFor="nc-city">Città</Label>
                                <Input id="nc-city" value={form.city} onChange={e => set({ city: e.target.value })} placeholder="Milano" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="nc-prov">Provincia</Label>
                                <Input id="nc-prov" value={form.province} onChange={e => set({ province: e.target.value.toUpperCase() })} placeholder="MI" maxLength={2} className="uppercase" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 border-t pt-4">
                        <SectionTitle>Contatti</SectionTitle>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="nc-phone">Telefono</Label>
                                <Input id="nc-phone" type="tel" value={form.phone} onChange={e => set({ phone: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="nc-email">Email</Label>
                                <Input id="nc-email" type="email" value={form.email} onChange={e => set({ email: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annulla</Button>
                        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Crea Committente
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
