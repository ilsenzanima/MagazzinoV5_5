import { supabase } from "@/lib/supabase";
import { loadNotesService } from "./load-notes";

export interface VanItem {
    id: string;
    inventoryId: string;
    inventoryCode: string;
    inventoryName: string;
    inventoryModel: string;
    inventoryUnit: string;
    pieces?: number;
    quantity: number;
    coefficient?: number;
}

export interface Van {
    id: string;
    name: string;
    plate?: string;
    notes?: string;
    archived: boolean;
    items: VanItem[];
}

const ITEM_SELECT = `
    id, van_id, inventory_id, pieces, quantity, coefficient,
    inventory:inventory_id ( code, name, unit, model, coefficient )
`;

const mapItem = (it: any): VanItem => ({
    id: it.id,
    inventoryId: it.inventory_id,
    inventoryCode: it.inventory?.code || "",
    inventoryName: it.inventory?.name || "",
    inventoryModel: it.inventory?.model || "",
    inventoryUnit: it.inventory?.unit || "",
    pieces: it.pieces == null ? undefined : Number(it.pieces),
    quantity: Number(it.quantity),
    coefficient: Number(it.coefficient || it.inventory?.coefficient || 1),
});

const mapVan = (v: any, items: VanItem[]): Van => ({
    id: v.id, name: v.name, plate: v.plate || undefined, notes: v.notes || undefined, archived: !!v.archived, items,
});

export const vansService = {
    getAll: async (): Promise<Van[]> => {
        const { data: vans, error } = await supabase.from("vans").select("*").order("name");
        if (error) throw error;
        const ids = (vans || []).map(v => v.id);
        const byVan = new Map<string, VanItem[]>();
        if (ids.length > 0) {
            const { data: items, error: itemsError } = await supabase.from("van_items").select(ITEM_SELECT).in("van_id", ids);
            if (itemsError) throw itemsError;
            (items || []).forEach((it: any) => {
                const list = byVan.get(it.van_id) || [];
                list.push(mapItem(it));
                byVan.set(it.van_id, list);
            });
        }
        return (vans || []).map(v => mapVan(v, byVan.get(v.id) || []));
    },

    // Quantità totale di ogni articolo sui furgoni (somma di tutti i furgoni), per le viste dei materiali
    getTotalsByItem: async (): Promise<Map<string, number>> => {
        const { data, error } = await supabase.from("van_items").select("inventory_id, quantity");
        if (error) throw error;
        const totals = new Map<string, number>();
        (data || []).forEach((r: any) => totals.set(r.inventory_id, (totals.get(r.inventory_id) || 0) + Number(r.quantity)));
        return totals;
    },

    getById: async (id: string): Promise<Van | null> => {
        const { data: van, error } = await supabase.from("vans").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!van) return null;
        const { data: items, error: itemsError } = await supabase.from("van_items").select(ITEM_SELECT).eq("van_id", id);
        if (itemsError) throw itemsError;
        return mapVan(van, (items || []).map(mapItem).sort((a, b) => a.inventoryName.localeCompare(b.inventoryName)));
    },

    create: async (input: { name: string; plate?: string; notes?: string }): Promise<string> => {
        const { data: userData } = await supabase.auth.getUser();
        const { data, error } = await supabase.from("vans")
            .insert({ name: input.name.trim(), plate: input.plate?.trim() || null, notes: input.notes?.trim() || null, created_by: userData?.user?.id })
            .select("id").single();
        if (error) throw error;
        return data.id as string;
    },

    update: async (id: string, input: { name?: string; plate?: string; notes?: string; archived?: boolean }): Promise<void> => {
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (input.name !== undefined) updates.name = input.name.trim();
        if (input.plate !== undefined) updates.plate = input.plate.trim() || null;
        if (input.notes !== undefined) updates.notes = input.notes.trim() || null;
        if (input.archived !== undefined) updates.archived = input.archived;
        const { error } = await supabase.from("vans").update(updates).eq("id", id);
        if (error) throw error;
    },

    // Un furgone con materiale dentro non si elimina: va svuotato o archiviato
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from("vans").delete().eq("id", id);
        if (error) throw error;
    },

    // Aggiunge un articolo; se il furgone lo ha già, somma le quantità
    addItem: async (vanId: string, item: { inventoryId: string; pieces?: number; quantity: number; coefficient?: number }): Promise<void> => {
        const { data: existing, error: findError } = await supabase.from("van_items")
            .select("id, pieces, quantity").eq("van_id", vanId).eq("inventory_id", item.inventoryId).maybeSingle();
        if (findError) throw findError;
        if (existing) {
            const pieces = existing.pieces == null && item.pieces == null ? null : Number(existing.pieces || 0) + Number(item.pieces || 0);
            const { error } = await supabase.from("van_items")
                .update({ quantity: Number(existing.quantity) + item.quantity, pieces }).eq("id", existing.id);
            if (error) throw error;
            return;
        }
        const { error } = await supabase.from("van_items").insert({
            van_id: vanId, inventory_id: item.inventoryId, pieces: item.pieces ?? null, quantity: item.quantity, coefficient: item.coefficient || 1,
        });
        if (error) throw error;
    },

    updateItem: async (itemId: string, fields: { pieces?: number | null; quantity: number }): Promise<void> => {
        const { error } = await supabase.from("van_items").update({ pieces: fields.pieces ?? null, quantity: fields.quantity }).eq("id", itemId);
        if (error) throw error;
    },

    removeItems: async (itemIds: string[]): Promise<void> => {
        const { error } = await supabase.from("van_items").delete().in("id", itemIds);
        if (error) throw error;
    },

    // Sposta le righe su una nota di carico da processare (le toglie dal furgone). Restituisce quante ne ha spostate
    moveToNote: async (itemIds: string[], noteId: string): Promise<number> => {
        const { data, error } = await supabase.rpc("move_van_items_to_note", { p_item_ids: itemIds, p_note_id: noteId });
        if (error) throw error;
        return Number(data);
    },

    // Crea una nota di carico (con o senza commessa) e ci sposta le righe. Restituisce l'id della nota
    moveToNewNote: async (itemIds: string[], note: { jobId?: string; notes?: string; date: string; noteType: "uscita" | "reso" }): Promise<string> => {
        const created = await loadNotesService.create({ date: note.date, noteType: note.noteType, jobId: note.jobId, notes: note.notes, items: [] });
        try {
            await vansService.moveToNote(itemIds, created.id);
        } catch (e) {
            await loadNotesService.delete(created.id);
            throw e;
        }
        return created.id;
    },
};
