"use client"

import { useState } from "react";
import { notify } from "@/lib/notify";
import { inventoryApi } from "@/lib/api";
import type { InventoryItem } from "@/lib/types";
import { NewItemWizard, WizardDraft, EMPTY_DRAFT } from "@/components/inventory/NewItemWizard";

interface NewItemDialogProps {
    open: boolean;
    onClose: () => void;
    onCreated: (item: InventoryItem) => void;
    initialName?: string;   // per esempio il testo che si stava cercando
}

// Crea l'articolo con gli stessi controlli della pagina «Nuovo articolo»
export async function createItemFromDraft(draft: WizardDraft): Promise<InventoryItem | null> {
    const coefficient = parseFloat(draft.coefficient.replace(",", "."));
    const minStock = draft.wantsMinStock ? parseInt(draft.minStock, 10) : 0;
    if (isNaN(coefficient) || coefficient <= 0) {
        notify.warning("Il coefficiente deve essere maggiore di 0");
        return null;
    }
    if (isNaN(minStock) || minStock < 0) {
        notify.warning("La scorta minima non può essere negativa");
        return null;
    }

    const isDuplicate = await inventoryApi.checkDuplicate({
        name: draft.name,
        brand: draft.brand,
        type: draft.type,
        model: draft.model,
    });
    if (isDuplicate) {
        notify.warning("Articolo già presente! Specificare la variante per differenziarlo.");
        return null;
    }

    let imageUrl = draft.imageUrl;
    if (draft.imageFile) {
        try {
            imageUrl = await inventoryApi.uploadImage(draft.imageFile);
        } catch (uploadErr) {
            console.error("Image upload failed", uploadErr);
            notify.error("Errore caricamento immagine, l'articolo verrà creato senza immagine.");
        }
    }

    let code: string;
    try {
        code = await inventoryApi.getNextCode();
    } catch {
        code = `PPA-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
    }

    const attrs = draft.customModel ? {} : draft.variantAttributes;
    return await inventoryApi.create({
        code,
        name: draft.name,
        model: draft.model,
        brand: draft.brand,
        type: draft.type,
        supplierCode: draft.hasSupplierCode ? draft.supplierCode : "",
        quantity: 0,
        minStock,
        unit: draft.unit as any,
        coefficient,
        packQuantity: draft.packQuantity.trim() !== "" ? parseFloat(draft.packQuantity.replace(",", ".")) : null,
        description: draft.description,
        image: imageUrl,
        variantAttributes: attrs && Object.keys(attrs).length > 0 ? attrs : null,
    } as any) as InventoryItem;
}

// Procedura guidata di creazione articolo in un modale, per usarla dove manca un materiale (acquisti, ordini)
export function NewItemDialog({ open, onClose, onCreated, initialName }: NewItemDialogProps) {
    const [busy, setBusy] = useState(false);
    if (!open) return null;

    return (
        <NewItemWizard
            open
            closeLabel="Annulla"
            initialDraft={initialName?.trim() ? { ...EMPTY_DRAFT, name: initialName.trim() } : undefined}
            onClose={() => { if (!busy) onClose(); }}
            onCreate={async (draft) => {
                setBusy(true);
                try {
                    const created = await createItemFromDraft(draft);
                    if (!created) return false;
                    notify.success(`Articolo ${created.code} creato`);
                    onCreated(created);
                    return true;
                } catch (error) {
                    console.error("Failed to create item", error);
                    notify.error("Errore durante la creazione dell'articolo");
                    return false;
                } finally {
                    setBusy(false);
                }
            }}
        />
    );
}
