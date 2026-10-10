import '@testing-library/jest-dom'; // tipi dei comandi toBeInTheDocument, toHaveAttribute...
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MovementDetailContent from '../MovementDetailContent';
import type { DeliveryNote } from '@/lib/types';
import { costAnalysisApi } from '@/lib/services/cost-analysis';

let mockRole: string | null = 'admin';

jest.mock('@/components/auth-provider', () => ({
    useAuth: () => ({ userRole: mockRole }),
}));
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
}));
// La finestra "sposta articoli" importa codice del server (next/cache): non serve a questa prova
jest.mock('@/components/movements/MoveItemsDialog', () => ({ __esModule: true, default: () => null }));
jest.mock('@/lib/services/cost-analysis', () => ({
    costAnalysisApi: { getByJobId: jest.fn() },
}));

const movement = (overrides: Partial<DeliveryNote> = {}): DeliveryNote => ({
    id: 'dn1',
    type: 'exit',
    number: '12/PP26',
    date: '2026-10-01',
    jobId: 'job1',
    causal: 'Rifornimento cantiere',
    pickupLocation: '',
    deliveryLocation: '',
    items: [
        { id: 'i1', deliveryNoteId: 'dn1', inventoryId: 'a', inventoryName: 'Silicone', inventoryCode: 'SIL-1', inventoryUnit: 'PZ', quantity: 10, price: 5 },
        { id: 'i2', deliveryNoteId: 'dn1', inventoryId: 'b', inventoryName: 'Viti', inventoryCode: 'VIT-1', inventoryUnit: 'PZ', quantity: 2, price: 3 },
    ],
    ...overrides,
});

const analysisRows = [
    { itemId: 'a', unitPrice: 8 },   // prezzo di commessa per il silicone
    { itemId: 'b', unitPrice: null }, // viti: nessun prezzo impostato
];

describe('MovementDetailContent: prezzi di acquisto / di commessa', () => {
    beforeEach(() => {
        mockRole = 'admin';
        (costAnalysisApi.getByJobId as jest.Mock).mockReset().mockResolvedValue(analysisRows);
    });

    it('di default mostra i prezzi di acquisto e permette di passare ai prezzi di commessa', async () => {
        render(<MovementDetailContent initialMovement={movement()} />);

        // 10 x 5 + 2 x 3 = 56
        expect(screen.getByText('€ 56,00')).toBeInTheDocument();

        const toggle = await screen.findByRole('switch');
        expect(toggle).toHaveAttribute('aria-checked', 'false');

        fireEvent.click(toggle);
        // silicone a 8 (commessa), viti restano a 3 (acquisto): 10 x 8 + 2 x 3 = 86
        expect(await screen.findByText('€ 86,00')).toBeInTheDocument();
        expect(screen.getAllByText(/prezzo commessa/).length).toBeGreaterThan(0);
        expect(screen.getByText(/1 articolo senza prezzo di commessa mantiene il prezzo di acquisto/)).toBeInTheDocument();
        expect(screen.getByText(/Totale Documento \(prezzi di commessa\)/)).toBeInTheDocument();

        fireEvent.click(toggle);
        expect(await screen.findByText('€ 56,00')).toBeInTheDocument();
        expect(screen.queryByText(/prezzo commessa/)).not.toBeInTheDocument();
    });

    it('non mostra l\'interruttore se la commessa non ha prezzi per gli articoli del documento', async () => {
        (costAnalysisApi.getByJobId as jest.Mock).mockResolvedValue([{ itemId: 'zzz', unitPrice: 4 }]);
        render(<MovementDetailContent initialMovement={movement()} />);
        await waitFor(() => expect(costAnalysisApi.getByJobId).toHaveBeenCalled());
        expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });

    it('non carica né mostra nulla per chi non può vedere i prezzi', async () => {
        mockRole = 'user';
        render(<MovementDetailContent initialMovement={movement()} />);
        expect(costAnalysisApi.getByJobId).not.toHaveBeenCalled();
        expect(screen.queryByRole('switch')).not.toBeInTheDocument();
        expect(screen.queryByText('€ 56,00')).not.toBeInTheDocument();
    });

    it('non carica i prezzi di commessa per un documento senza commessa', () => {
        render(<MovementDetailContent initialMovement={movement({ jobId: undefined })} />);
        expect(costAnalysisApi.getByJobId).not.toHaveBeenCalled();
        expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });
});
