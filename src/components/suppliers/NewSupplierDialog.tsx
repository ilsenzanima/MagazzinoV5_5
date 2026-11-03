"use client"

import { useEffect, useState } from "react";
import { notify } from "@/lib/notify";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { suppliersApi } from "@/lib/api";
import { DuplicateSuppliersNotice } from "@/components/suppliers/DuplicateSuppliersNotice";

const EMPTY_FORM = {
    name: "", address: "", vatNumber: "", email: "", phone: "",
    pec: "", website: "", paymentTerms: "", notes: "",
};

interface NewSupplierDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (supplier: { id: string }) => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</h3>;
}

// Creazione fornitore in un modale, con la stessa impostazione del nuovo committente
export function NewSupplierDialog({ open, onOpenChange, onCreated }: NewSupplierDialogProps) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    // Ogni apertura riparte da un modulo vuoto
    useEffect(() => {
        if (open) setForm(EMPTY_FORM);
    }, [open]);

    const set = (patch: Partial<typeof EMPTY_FORM>) => setForm(prev => ({ ...prev, ...patch }));

    const handleCreate = async () => {
        if (!form.name.trim()) { notify.warning("Il nome del fornitore è obbligatorio"); return; }
        try {
            setSaving(true);
            const created = await suppliersApi.create({ ...form, name: form.name.trim() });
            notify.success("Fornitore creato");
            onOpenChange(false);
            onCreated(created);
        } catch (error) {
            console.error("Error creating supplier:", error);
            notify.error("Errore durante la creazione del fornitore");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Nuovo Fornitore</DialogTitle></DialogHeader>
                <form
                    onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
                    className="space-y-5 py-2"
                >
                    <div className="space-y-3">
                        <SectionTitle>Anagrafica</SectionTitle>
                        <div className="space-y-1">
                            <Label htmlFor="ns-name">Ragione sociale / Nome *</Label>
                            <Input id="ns-name" autoFocus value={form.name} onChange={e => set({ name: e.target.value })} placeholder="Inserisci il nome dell'azienda o del fornitore" />
                        </div>
                        <DuplicateSuppliersNotice name={form.name} vatNumber={form.vatNumber} address={form.address} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="ns-vat">Partita IVA / Codice fiscale</Label>
                                <Input id="ns-vat" value={form.vatNumber} onChange={e => set({ vatNumber: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="ns-pay">Condizioni di pagamento</Label>
                                <Input id="ns-pay" value={form.paymentTerms} onChange={e => set({ paymentTerms: e.target.value })} placeholder="Es. bonifico 30 gg data fattura" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="ns-address">Indirizzo sede</Label>
                            <Textarea id="ns-address" value={form.address} onChange={e => set({ address: e.target.value })} placeholder="Via Roma 10, 00100 Roma (RM)" className="min-h-[60px]" />
                        </div>
                    </div>

                    <div className="space-y-3 border-t pt-4">
                        <SectionTitle>Contatti</SectionTitle>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="ns-phone">Telefono</Label>
                                <Input id="ns-phone" type="tel" value={form.phone} onChange={e => set({ phone: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="ns-email">Email</Label>
                                <Input id="ns-email" type="email" value={form.email} onChange={e => set({ email: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="ns-pec">PEC</Label>
                                <Input id="ns-pec" type="email" value={form.pec} onChange={e => set({ pec: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="ns-web">Sito web</Label>
                                <Input id="ns-web" value={form.website} onChange={e => set({ website: e.target.value })} placeholder="https://" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 border-t pt-4">
                        <SectionTitle>Note</SectionTitle>
                        <Textarea id="ns-notes" value={form.notes} onChange={e => set({ notes: e.target.value })} className="min-h-[60px]" />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annulla</Button>
                        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Crea Fornitore
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
