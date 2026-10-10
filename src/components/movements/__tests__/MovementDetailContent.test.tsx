import '@testing-library/jest-dom'; // tipi dei comandi toBeInTheDocument, toHaveAttribute...
import { render, screen, fireEvent } from '@testing-library/react';
import MovementDetailContent from '../MovementDetailContent';
import type { DeliveryNote } from '@/lib/types';
import { loadJobPriceMap } from '@/lib/services/job-price-lookup';

let mockRole: string | null = 'admin';

jest.mock('@/components/auth-provider', () => ({
    useAuth: () => ({ userRole: mockRole }),
}));
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
}));
// La finestra "sposta articoli" importa codice del server (next/cache): non serve a questa prova
jest.mock('@/components/movements/MoveItemsDialog', () => ({ __esModule: true, default: () => null }));
jest.mock('@/lib/services/job-price-lookup', () => ({
    loadJobPriceMap: jest.fn(),
}));
const loadPrices = loadJobPriceMap as jest.Mock;

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

// Prezzi di commessa restituiti dal caricatore: silicone 8, viti nessun prezzo (restano a quello del lotto)
const jobPrices = new Map([['a', 8]]);

describe('MovementDetailContent: prezzi di acquisto / di commessa', () => {
    beforeEach(() => {
        mockRole = 'admin';
        loadPrices.mockReset().mockResolvedValue(jobPrices);
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

    it('mostra il prezzo che la commessa blocca per tutti gli articoli del documento (più lotti)', async () => {
        // le viti hanno più lotti (3 e 6): il DDT mostra il lotto, la commessa blocca il più alto
        loadPrices.mockResolvedValue(new Map([['a', 7], ['b', 6]]));
        render(<MovementDetailContent initialMovement={movement()} />);
        fireEvent.click(await screen.findByRole('switch'));
        // 10 x 7 + 2 x 6 = 82
        expect(await screen.findByText('€ 82,00')).toBeInTheDocument();
        expect(screen.queryByText(/senza prezzo di commessa/)).not.toBeInTheDocument();
    });

    it('chiede i prezzi per gli articoli del documento della sua commessa', async () => {
        render(<MovementDetailContent initialMovement={movement()} />);
        await screen.findByRole('switch');
        expect(loadPrices).toHaveBeenCalledWith('job1', ['a', 'b']);
    });

    it('se nessun articolo ha un prezzo di commessa mostra l\'interruttore disattivato con la spiegazione', async () => {
        loadPrices.mockResolvedValue(new Map([['zzz', 4]]));
        render(<MovementDetailContent initialMovement={movement()} />);
        const toggle = await screen.findByRole('switch');
        expect(toggle).toBeDisabled();
        expect(screen.getByText(/Nessun prezzo di commessa disponibile per gli articoli di questo documento/)).toBeInTheDocument();
        expect(screen.getByText('€ 56,00')).toBeInTheDocument();
    });

    it('se non c\'è alcun prezzo di commessa l\'interruttore resta disattivato', async () => {
        loadPrices.mockResolvedValue(new Map());
        render(<MovementDetailContent initialMovement={movement()} />);
        expect(await screen.findByRole('switch')).toBeDisabled();
    });

    it('non carica né mostra nulla per chi non può vedere i prezzi', async () => {
        mockRole = 'user';
        render(<MovementDetailContent initialMovement={movement()} />);
        expect(loadPrices).not.toHaveBeenCalled();
        expect(screen.queryByRole('switch')).not.toBeInTheDocument();
        expect(screen.queryByText('€ 56,00')).not.toBeInTheDocument();
    });

    it('non carica i prezzi di commessa per un documento senza commessa', () => {
        render(<MovementDetailContent initialMovement={movement({ jobId: undefined })} />);
        expect(loadPrices).not.toHaveBeenCalled();
        expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });
});
