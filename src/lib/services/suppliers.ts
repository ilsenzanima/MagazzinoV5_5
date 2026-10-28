import { supabase } from '@/lib/supabase';
import { Supplier, SupplierOverview, SupplierContact } from '@/lib/types';
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
    pec: db.pec ?? undefined,
    website: db.website ?? undefined,
    paymentTerms: db.payment_terms ?? undefined,
    notes: db.notes ?? undefined,
    isTechnical: db.is_technical ?? false,
    createdAt: db.created_at
});

const mapDbToOverview = (db: any): SupplierOverview => ({
    ...mapDbToSupplier(db),
    purchasesCount: Number(db.purchases_count ?? 0),
    lastPurchaseDate: db.last_purchase_date ?? null,
    spentTotal: Number(db.spent_total ?? 0),
    spentYear: Number(db.spent_year ?? 0),
    missingVat: !!db.missing_vat,
    missingEmail: !!db.missing_email,
    missingPhone: !!db.missing_phone,
});

const mapDbToContact = (db: any): SupplierContact => ({
    id: db.id,
    supplierId: db.supplier_id,
    name: db.name,
    role: db.role ?? undefined,
    email: db.email ?? undefined,
    phone: db.phone ?? undefined,
    notes: db.notes ?? undefined,
});

export const mapSupplierToDb = (supplier: Partial<Supplier>) => ({
    name: supplier.name,
    vat_number: supplier.vatNumber,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address,
    pec: supplier.pec,
    website: supplier.website,
    payment_terms: supplier.paymentTerms,
    notes: supplier.notes,
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
    // Elenco per la pagina Fornitori: anagrafica + statistiche, con filtri e ordinamento lato database.
    // Le voci «tecniche» stanno sempre in fondo.
    getOverview: async ({ page = 1, limit = 50, search = '', completeness = 'all', sort = 'name', dir = 'asc', year = new Date().getFullYear() }: {
        page?: number; limit?: number; search?: string; year?: number;
        completeness?: 'all' | 'incomplete' | 'complete';
        sort?: 'name' | 'last' | 'year' | 'total' | 'count';
        dir?: 'asc' | 'desc';
    }) => {
        // Funzione al posto della vista: il «speso» si calcola per l'anno scelto
        let query = supabase.rpc('suppliers_overview_for_year', { p_year: year }, { count: 'exact' });

        const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean).map(w => w.replace(/[,()%*\\]/g, '')).filter(Boolean);
        for (const w of words) {
            query = query.or(`name.ilike.%${w}%,vat_number.ilike.%${w}%,email.ilike.%${w}%,phone.ilike.%${w}%,address.ilike.%${w}%,notes.ilike.%${w}%`);
        }
        if (completeness === 'incomplete') query = query.or('missing_vat.eq.true,missing_email.eq.true,missing_phone.eq.true').eq('is_technical', false);
        if (completeness === 'complete') query = query.eq('missing_vat', false).eq('missing_email', false).eq('missing_phone', false);

        const asc = dir === 'asc';
        query = query.order('is_technical', { ascending: true });
        if (sort === 'last') query = query.order('last_purchase_date', { ascending: asc, nullsFirst: false });
        else if (sort === 'year') query = query.order('spent_year', { ascending: asc });
        else if (sort === 'total') query = query.order('spent_total', { ascending: asc });
        else if (sort === 'count') query = query.order('purchases_count', { ascending: asc });
        else query = query.order('name', { ascending: asc });
        if (sort !== 'name') query = query.order('name', { ascending: true });

        const from = (page - 1) * limit;
        const { data, error, count } = await fetchWithTimeout(query.range(from, from + limit - 1));
        if (error) throw error;
        return { data: (data || []).map(mapDbToOverview), total: count ?? 0 };
    },

    // Anni in cui ci sono acquisti, dal più recente
    getPurchaseYears: async (): Promise<number[]> => {
        const { data, error } = await supabase.rpc('supplier_purchase_years');
        if (error) throw error;
        return (data || []) as number[];
    },

    getOverviewById: async (id: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase.from('suppliers_overview').select('*').eq('id', id).single()
        );
        if (error) throw error;
        return mapDbToOverview(data);
    },

    getContacts: async (supplierId: string): Promise<SupplierContact[]> => {
        const { data, error } = await supabase.from('supplier_contacts').select('*').eq('supplier_id', supplierId).order('created_at');
        if (error) throw error;
        return (data || []).map(mapDbToContact);
    },
    saveContact: async (supplierId: string, contact: Omit<SupplierContact, 'id' | 'supplierId'> & { id?: string }): Promise<SupplierContact> => {
        const payload = {
            supplier_id: supplierId,
            name: contact.name.trim(),
            role: contact.role?.trim() || null,
            email: contact.email?.trim() || null,
            phone: contact.phone?.trim() || null,
            notes: contact.notes?.trim() || null,
        };
        const q = contact.id
            ? supabase.from('supplier_contacts').update(payload).eq('id', contact.id)
            : supabase.from('supplier_contacts').insert(payload);
        const { data, error } = await q.select().single();
        if (error) throw error;
        return mapDbToContact(data);
    },
    deleteContact: async (id: string) => {
        const { error } = await supabase.from('supplier_contacts').delete().eq('id', id);
        if (error) throw error;
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
