import { supabase } from '@/lib/supabase';
import type { AuditLot } from '@/lib/utils/purchase-price-audit';

const PAGE_SIZE = 1000;

export interface PackItem {
    id: string;
    name: string;
    model: string | null;
    brand: string | null;
    unit: string | null;
    code: string | null;
    packQuantity: number | null;
}

// Righe di acquisti veri (non ordini, non cancellati) con autore e fornitore, per il controllo prezzi.
export const purchaseAuditApi = {
    getLots: async (): Promise<AuditLot[]> => {
        const lots: AuditLot[] = [];
        for (let from = 0; ; from += PAGE_SIZE) {
            const { data, error } = await supabase
                .from('purchase_items')
                .select(
                    'id, item_id, purchase_id, price, price_changed_at, quantity, inventory(name, unit, pack_quantity, price_check_ok_at), ' +
                    'purchases!inner(delivery_note_number, delivery_note_date, created_at, created_by, order_type, deleted_at, suppliers(name), profiles(full_name))'
                )
                .eq('purchases.order_type', 'purchase')
                .is('purchases.deleted_at', null)
                .not('item_id', 'is', null)
                .order('id', { ascending: true })
                .range(from, from + PAGE_SIZE - 1);
            if (error) throw error;

            for (const row of (data ?? []) as any[]) {
                const pu = Array.isArray(row.purchases) ? row.purchases[0] : row.purchases;
                if (!pu) continue;
                const inv = Array.isArray(row.inventory) ? row.inventory[0] : row.inventory;
                const sup = Array.isArray(pu.suppliers) ? pu.suppliers[0] : pu.suppliers;
                const prof = Array.isArray(pu.profiles) ? pu.profiles[0] : pu.profiles;
                lots.push({
                    purchaseId: row.purchase_id,
                    itemId: row.item_id,
                    itemName: inv?.name ?? 'Articolo senza nome',
                    itemUnit: inv?.unit ?? null,
                    price: Number(row.price),
                    date: (pu.delivery_note_date || pu.created_at || '').slice(0, 10) || null,
                    deliveryNoteNumber: pu.delivery_note_number ?? null,
                    supplierName: sup?.name ?? null,
                    createdBy: pu.created_by ?? null,
                    createdByName: prof?.full_name ?? null,
                    quantity: row.quantity !== null && row.quantity !== undefined ? Number(row.quantity) : null,
                    createdAt: pu.created_at ?? null,
                    priceChangedAt: row.price_changed_at ?? null,
                    packQuantity: inv?.pack_quantity !== null && inv?.pack_quantity !== undefined ? Number(inv.pack_quantity) : null,
                    reviewedAt: inv?.price_check_ok_at ?? null,
                });
            }
            if (!data || data.length < PAGE_SIZE) break;
        }
        return lots;
    },

    // Segna l'articolo come controllato (i lotti già presenti non vengono più segnalati) o toglie il segno
    setReviewed: async (itemId: string, reviewed: boolean): Promise<string | null> => {
        const { data: { user } } = await supabase.auth.getUser();
        const now = reviewed ? new Date().toISOString() : null;
        const { error } = await supabase
            .from('inventory')
            .update({ price_check_ok_at: now, price_check_ok_by: reviewed ? user?.id ?? null : null })
            .eq('id', itemId);
        if (error) throw error;
        return now;
    },

    setPackQuantity: async (itemId: string, packQuantity: number | null): Promise<void> => {
        const { error } = await supabase.from('inventory').update({ pack_quantity: packQuantity }).eq('id', itemId);
        if (error) throw error;
    },

    // Tutti gli articoli (con le loro varianti: stesso nome, modello o marca diversi) per la modifica rapida
    getPackItems: async (): Promise<PackItem[]> => {
        const items: PackItem[] = [];
        for (let from = 0; ; from += PAGE_SIZE) {
            const { data, error } = await supabase
                .from('inventory')
                .select('id, name, model, brand, unit, code, pack_quantity')
                .is('deleted_at', null)
                .order('name', { ascending: true })
                .order('id', { ascending: true })
                .range(from, from + PAGE_SIZE - 1);
            if (error) throw error;
            for (const r of (data ?? []) as any[]) {
                items.push({
                    id: r.id,
                    name: r.name ?? '',
                    model: r.model ?? null,
                    brand: r.brand ?? null,
                    unit: r.unit ?? null,
                    code: r.code ?? null,
                    packQuantity: r.pack_quantity !== null && r.pack_quantity !== undefined ? Number(r.pack_quantity) : null,
                });
            }
            if (!data || data.length < PAGE_SIZE) break;
        }
        return items;
    },
};
