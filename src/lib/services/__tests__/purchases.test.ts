import { mapDbToPurchase } from '../purchases';

describe('mapDbToPurchase', () => {
    it('should map database object to Purchase type', () => {
        const dbPurchase = {
            id: '123',
            supplier_id: 'sup-1',
            suppliers: { name: 'Fornitore Test' },
            delivery_note_number: 'DDT-001',
            delivery_note_date: '2026-01-15',
            notes: 'Note test',
            created_by: 'user-1',
            profiles: { full_name: 'Mario Rossi' },
            created_at: '2026-01-15T10:00:00Z',
            purchase_items: [
                { price: 10, quantity: 5 },
                { price: 20, quantity: 2 },
            ],
            job_id: 'job-1',
            jobs: { code: 'CANT-001' },
            document_url: 'https://example.com/doc.pdf',
        };

        const result = mapDbToPurchase(dbPurchase);

        expect(result.id).toBe('123');
        expect(result.supplierId).toBe('sup-1');
        expect(result.supplierName).toBe('Fornitore Test');
        expect(result.deliveryNoteNumber).toBe('DDT-001');
        expect(result.deliveryNoteDate).toBe('2026-01-15');
        expect(result.notes).toBe('Note test');
        expect(result.createdBy).toBe('user-1');
        expect(result.createdByName).toBe('Mario Rossi');
        expect(result.jobId).toBe('job-1');
        expect(result.jobCode).toBe('CANT-001');
        expect(result.documentUrl).toBe('https://example.com/doc.pdf');
    });

    it('should calculate total amount from items', () => {
        const dbPurchase = {
            id: '123',
            purchase_items: [
                { price: 10, quantity: 5 },  // 50
                { price: 20, quantity: 2 },  // 40
            ],
        };

        const result = mapDbToPurchase(dbPurchase);

        expect(result.totalAmount).toBe(90);
    });

    it('should handle null price as 0', () => {
        const dbPurchase = {
            id: '123',
            purchase_items: [
                { price: null, quantity: 5 },
                { price: 10, quantity: 2 },
            ],
        };

        const result = mapDbToPurchase(dbPurchase);

        expect(result.totalAmount).toBe(20);
    });

    it('should handle missing purchase_items', () => {
        const dbPurchase = {
            id: '123',
        };

        const result = mapDbToPurchase(dbPurchase);

        expect(result.items).toBeUndefined();
        expect(result.totalAmount).toBeUndefined();
    });
});
