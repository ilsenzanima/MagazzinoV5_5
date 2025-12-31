"use client";

import { useState } from "react";
import { Client, clientsApi, jobsApi, deliveryNotesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface ClientEditDialogProps {
    client: Client | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}

export function ClientEditDialog({
    client,
    open,
    onOpenChange,
    onSaved
}: ClientEditDialogProps) {
    const [editForm, setEditForm] = useState<Partial<Client>>({});
    const [shouldUpdateActiveJobs, setShouldUpdateActiveJobs] = useState(false);
    const [shouldUpdateDeliveryNotes, setShouldUpdateDeliveryNotes] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Reset form when client changes
    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen && client) {
            setEditForm({
                name: client.name,
                vatNumber: client.vatNumber,
                email: client.email,
                phone: client.phone,
                street: client.street,
                streetNumber: client.streetNumber,
                postalCode: client.postalCode,
                city: client.city,
                province: client.province
            });
            setShouldUpdateActiveJobs(false);
            setShouldUpdateDeliveryNotes(false);
        }
        onOpenChange(isOpen);
    };

    // Helper to construct address
    const constructAddress = (c: Partial<Client>) => {
        return `${c.street || ''} ${c.streetNumber || ''}, ${c.postalCode || ''} ${c.city || ''} ${c.province ? '(' + c.province + ')' : ''}`
            .trim()
            .replace(/^,/, '')
            .replace(/,$/, '')
            .trim();
    };

    const handleUpdateClient = async () => {
        if (!client || !editForm.name) return;

        try {
            setIsSaving(true);

            // 1. Calculate new address
            const newAddress = constructAddress(editForm);

            // 2. Update Client (basic update)
            await clientsApi.update(client.id, {
                name: editForm.name,
                vatNumber: editForm.vatNumber,
                email: editForm.email,
                phone: editForm.phone,
                street: editForm.street,
                streetNumber: editForm.streetNumber,
                postalCode: editForm.postalCode,
                city: editForm.city,
                province: editForm.province,
                address: newAddress
            });

            const messages: string[] = ["Committente aggiornato con successo."];

            // 3. Update Job Addresses if requested
            if (shouldUpdateActiveJobs && newAddress) {
                console.log('Updating active jobs to new address:', newAddress);
                const jobs = await jobsApi.getByClientId(client.id);
                const activeJobs = jobs.filter(job => job.status === 'active');
                console.log(`Found ${activeJobs.length} active jobs to update out of ${jobs.length} total`);

                const updatePromises = activeJobs.map(job => {
                    return jobsApi.update(job.id, { siteAddress: newAddress });
                });

                await Promise.all(updatePromises);
                if (activeJobs.length > 0) {
                    messages.push(`Aggiornati ${activeJobs.length} cantieri attivi.`);
                }
            }

            // 4. Update Delivery Notes if requested (NEW)
            if (shouldUpdateDeliveryNotes && newAddress) {
                // Fetch ALL jobs for the client to capture historical notes too
                const jobs = await jobsApi.getByClientId(client.id);
                const jobIds = jobs.map(j => j.id);

                if (jobIds.length > 0) {
                    const updatedCount = await deliveryNotesApi.updateLocationBatch(jobIds, newAddress);
                    if (updatedCount !== null && updatedCount !== undefined) {
                        messages.push(`Aggiornate ${updatedCount} bolle esistenti.`);
                    }
                }
            }

            // Show feedback
            alert(messages.join("\n"));

            onSaved();
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to update client:", error);
            alert("Errore durante l'aggiornamento del committente");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Modifica Committente</DialogTitle>
                    <DialogDescription>
                        Modifica i dati del committente. Se cambi l'indirizzo, le commesse associate a questo indirizzo verranno aggiornate.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Ragione Sociale / Nome *</Label>
                            <Input
                                id="name"
                                value={editForm.name || ""}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="vatNumber">P.IVA / Codice Fiscale</Label>
                            <Input
                                id="vatNumber"
                                value={editForm.vatNumber || ""}
                                onChange={(e) => setEditForm({ ...editForm, vatNumber: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={editForm.email || ""}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Telefono</Label>
                            <Input
                                id="phone"
                                value={editForm.phone || ""}
                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Indirizzo Sede Legale</Label>
                        <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-8">
                                <Input
                                    placeholder="Via/Piazza"
                                    value={editForm.street || ""}
                                    onChange={(e) => setEditForm({ ...editForm, street: e.target.value })}
                                />
                            </div>
                            <div className="col-span-4">
                                <Input
                                    placeholder="N. Civico"
                                    value={editForm.streetNumber || ""}
                                    onChange={(e) => setEditForm({ ...editForm, streetNumber: e.target.value })}
                                />
                            </div>
                            <div className="col-span-3">
                                <Input
                                    placeholder="CAP"
                                    value={editForm.postalCode || ""}
                                    onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })}
                                />
                            </div>
                            <div className="col-span-6">
                                <Input
                                    placeholder="Città"
                                    value={editForm.city || ""}
                                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                                />
                            </div>
                            <div className="col-span-3">
                                <Input
                                    placeholder="Prov"
                                    maxLength={2}
                                    className="uppercase"
                                    value={editForm.province || ""}
                                    onChange={(e) => setEditForm({ ...editForm, province: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="update-jobs"
                                checked={shouldUpdateActiveJobs}
                                onCheckedChange={(checked) => setShouldUpdateActiveJobs(checked as boolean)}
                            />
                            <Label htmlFor="update-jobs" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                Aggiorna l'indirizzo nelle commesse attive
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="update-delivery-notes"
                                checked={shouldUpdateDeliveryNotes}
                                onCheckedChange={(checked) => setShouldUpdateDeliveryNotes(checked as boolean)}
                            />
                            <Label htmlFor="update-delivery-notes" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                Aggiorna l'indirizzo nelle bolle esistenti
                            </Label>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Annulla</Button>
                    <Button onClick={handleUpdateClient} disabled={isSaving || !editForm.name}>
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Salvataggio...
                            </>
                        ) : (
                            "Salva Modifiche"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
