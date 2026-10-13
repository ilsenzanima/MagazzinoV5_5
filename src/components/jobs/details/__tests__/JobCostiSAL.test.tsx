import '@testing-library/jest-dom'; // tipi dei comandi toBeInTheDocument...
import { render, screen } from '@testing-library/react';
import { JobCostiSAL } from '../JobCostiSAL';
import { loadJobPriceMap } from '@/lib/services/job-price-lookup';
import type { Movement } from '@/lib/api';

jest.mock('@/lib/services/job-price-lookup', () => ({ loadJobPriceMap: jest.fn() }));
jest.mock('@/lib/notify', () => ({ notify: { error: jest.fn(), success: jest.fn(), warning: jest.fn(), info: jest.fn() } }));
jest.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => ({ isMobile: false }) }));
jest.mock('@/hooks/useBatchUpload', () => ({
    useBatchUpload: () => ({ items: [], uploading: false, addFiles: jest.fn(), uploadAll: jest.fn(), clear: jest.fn(), progress: 0 }),
}));
jest.mock('@/components/ui/upload-status-row', () => ({ UploadStatusBar: () => null }));
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('@/lib/api', () => ({
    purchasesApi: { getByJobId: jest.fn().mockResolvedValue([]) },
    attendanceApi: { getWorkerCostsByJobId: jest.fn().mockResolvedValue({ rows: [], totalCost: 0 }) },
    correctionsApi: {},
}));
jest.mock('@/lib/services/sal', () => ({
    salApi: { getByJobId: jest.fn().mockResolvedValue([]) },
    salCostsApi: { getByJobId: jest.fn().mockResolvedValue([]) },
    salNamesApi: { getByJobId: jest.fn().mockResolvedValue([]) },
}));

const loadPrices = loadJobPriceMap as jest.Mock;

// Uscita di 10 unità dell'articolo "a" (prezzo del lotto 5) e di 2 dell'articolo "b" (lotto 3)
const movements = [
    {
        id: 'm1', type: 'exit', itemId: 'a', itemCode: 'SIL-1', itemName: 'Silicone', itemUnit: 'PZ',
        quantity: -10, itemPrice: 5, deliveryNoteId: 'dn1', reference: '12/PP26', date: '2026-10-01T08:00:00Z',
    },
    {
        id: 'm2', type: 'exit', itemId: 'b', itemCode: 'VIT-1', itemName: 'Viti', itemUnit: 'PZ',
        quantity: -2, itemPrice: 3, deliveryNoteId: 'dn1', reference: '12/PP26', date: '2026-10-01T08:00:00Z',
    },
] as unknown as Movement[];

const renderTab = () => render(<JobCostiSAL jobId="job1" jobCode="2026-04-DAR" materialCost={0} movements={movements} />);

describe('JobCostiSAL: valorizzazione dei materiali con i prezzi di commessa', () => {
    beforeEach(() => {
        loadPrices.mockReset();
    });

    it('usa il prezzo di commessa (impostato o massimo d\'acquisto) invece del prezzo del lotto', async () => {
        // silicone: la commessa blocca 8 (lotto 5); viti: nessun prezzo di commessa, restano a 3
        loadPrices.mockResolvedValue(new Map([['a', 8]]));
        renderTab();
        // 10 x 8 + 2 x 3 = 86
        expect((await screen.findAllByText(/86,00/)).length).toBeGreaterThan(0);
        expect(screen.queryByText(/56,00/)).not.toBeInTheDocument();
        expect(loadPrices).toHaveBeenCalledWith('job1', ['a', 'b']);
    });

    it('senza prezzi di commessa mantiene i prezzi dei lotti', async () => {
        loadPrices.mockResolvedValue(new Map());
        renderTab();
        // 10 x 5 + 2 x 3 = 56
        expect((await screen.findAllByText(/56,00/)).length).toBeGreaterThan(0);
    });

    it('se il caricamento dei prezzi di commessa fallisce mostra comunque i prezzi dei lotti', async () => {
        loadPrices.mockRejectedValue(new Error('rete'));
        jest.spyOn(console, 'error').mockImplementation(() => {});
        renderTab();
        expect((await screen.findAllByText(/56,00/)).length).toBeGreaterThan(0);
    });
});
