import { supabase } from '@/lib/supabase';
import { Supplier } from '@/lib/types';
import { fetchWithTimeout, getSoftDeletePayload } from './utils';
import { clientMatchReason, ClientMatchReason, normalizeCompanyName, sameFreeTextAddress, vatDigits } from '@/lib/utils/client-match';

export interface SupplierDuplicate {
    id: string; name: string; vatNumber: string; address: string; reason: ClientMatchReason;
}

export const mapDbToSupplier = (db: any): Supplier => ({
    id: db.id,
    name: db.name,
    vatNumber: db.vat_number,
    email: db.email,
    phone: db.phone,
    address: db.address,
    createdAt: db.created_at
});

export const mapSupplierToDb = (supplier: Partial<Supplier>) => ({
    name: supplier.name,
    vat_number: supplier.vatNumber,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address
});

export const suppliersApi = {
    // Fornitori già presenti con la stessa partita IVA, un nome uguale/simile o lo stesso indirizzo (non eliminati)
    findDuplicates: async (name: string, vatNumber?: string, address?: string): Promise<SupplierDuplicate[]> => {
        const normalized = normalizeCompanyName(name);
        const vat = vatDigits(vatNumber);
        const columns = 'id, name, vat_number, address';
        const queries: PromiseLike<any>[] = [];
        if (normalized.length >= 3) {
            const firstToken = normalized.split(' ')[0].replace(/[%_,()]/g, '');
            if (firstToken.length >= 3) {
                queries.push(supabase.from('suppliers').select(columns).is('deleted_at', null).ilike('name', `%${firstToken}%`).limit(50));
            }
        }
        if (vat.length >= 8) {
            queries.push(supabase.from('suppliers').select(columns).is('deleted_at', null).ilike('vat_number', `%${vat}%`).limit(20));
        }
        const addressWord = (address ?? '').split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}]/gu, '')).sort((a, b) => b.length - a.length)[0] ?? '';
        if (addressWord.length >= 5) {
            queries.push(supabase.from('suppliers').select(columns).is('deleted_at', null).ilike('address', `%${addressWord}%`).limit(50));
        }
        if (queries.length === 0) return [];
        const results = await Promise.all(queries);
        const rows = new Map<string, any>();
        for (const r of results) {
            if (r.error) throw r.error;
            for (const row of r.data ?? []) rows.set(row.id, row);
        }
        const out: SupplierDuplicate[] = [];
        rows.forEach(row => {
            let reason = clientMatchReason({ name: row.name, vatNumber: row.vat_number }, { name, vatNumber });
            if (!reason && sameFreeTextAddress(row.address, address)) reason = 'stesso-indirizzo';
            if (reason) out.push({ id: row.id, name: row.name, vatNumber: row.vat_number ?? '', address: row.address ?? '', reason });
        });
        const rank: Record<ClientMatchReason, number> = { 'stessa-partita-iva': 0, 'stesso-nome': 1, 'stesso-indirizzo': 2, 'nome-simile': 3 };
        return out.sort((a, b) => rank[a.reason] - rank[b.reason]);
    },

    getAll: async () => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('suppliers')
                .select('*')
                .is('deleted_at', null)
                .order('name')
        );
        if (error) throw error;
        return data.map(mapDbToSupplier);
    },
    getPaginated: async ({ page = 1, limit = 10, search = '' }) => {
        let query = supabase.from('suppliers').select('*', { count: 'estimated' }).is('deleted_at', null);

        if (search) {
            query = query.ilike('name', `%${search}%`);
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        query = query
            .order('name')
            .range(from, to);

        const { data, error, count } = await fetchWithTimeout(query);

        if (error) throw error;

        return {
            data: data.map(mapDbToSupplier),
            total: count || 0
        };
    },
    getById: async (id: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('suppliers')
                .select('*')
                .eq('id', id)
                .single()
        );
        if (error) throw error;
        return mapDbToSupplier(data);
    },
    create: async (supplier: Partial<Supplier>) => {
        const dbSupplier = mapSupplierToDb(supplier);
        const { data, error } = await supabase.from('suppliers').insert(dbSupplier).select().single();
        if (error) throw error;
        return mapDbToSupplier(data);
    },
    update: async (id: string, supplier: Partial<Supplier>) => {
        const dbSupplier = mapSupplierToDb(supplier);
        const { data, error } = await supabase.from('suppliers').update(dbSupplier).eq('id', id).select().single();
        if (error) throw error;
        return mapDbToSupplier(data);
    },
    delete: async (id: string) => {
        const payload = await getSoftDeletePayload();
        const { error } = await supabase.from('suppliers').update(payload).eq('id', id);
        if (error) throw error;
    },

    restore: async (id: string) => {
        const { error } = await supabase
            .from('suppliers')
            .update({ deleted_at: null, deleted_by: null, deleted_by_name: null })
            .eq('id', id);
        if (error) throw error;
    },

    getDeleted: async () => {
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (error) throw error;
        return (data || []).map((d: any) => ({
            ...mapDbToSupplier(d),
            deletedAt: d.deleted_at as string,
            deletedByName: d.deleted_by_name as string | null,
        }));
    },
};
