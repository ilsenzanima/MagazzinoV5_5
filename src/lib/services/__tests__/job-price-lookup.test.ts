import { loadJobPriceMap } from '../job-price-lookup';
import { costAnalysisApi } from '../cost-analysis';
import { clientProposalsApi } from '../client-proposals';

jest.mock('../cost-analysis', () => ({
    costAnalysisApi: {
        getByJobId: jest.fn(),
        getProposalPriceLookup: jest.fn(),
        getMaxPurchasePrices: jest.fn(),
    },
}));
jest.mock('../client-proposals', () => ({
    clientProposalsApi: { getByConvertedJobId: jest.fn() },
}));

const getByJobId = costAnalysisApi.getByJobId as jest.Mock;
const getProposalPriceLookup = costAnalysisApi.getProposalPriceLookup as jest.Mock;
const getMaxPurchasePrices = costAnalysisApi.getMaxPurchasePrices as jest.Mock;
const getByConvertedJobId = clientProposalsApi.getByConvertedJobId as jest.Mock;

const row = (itemId: string | null, unitPrice: number | null, maxPurchasePrice: number | null) => ({
    itemId, unitPrice, maxPurchasePrice,
});

describe('loadJobPriceMap', () => {
    beforeEach(() => {
        getByJobId.mockReset().mockResolvedValue([]);
        getProposalPriceLookup.mockReset().mockResolvedValue(new Map());
        getMaxPurchasePrices.mockReset().mockResolvedValue(new Map());
        getByConvertedJobId.mockReset().mockResolvedValue(null);
    });

    it('per gli articoli già in analisi usa il prezzo impostato, altrimenti il massimo bloccato nella riga', async () => {
        getByJobId.mockResolvedValue([row('a', 8, 9), row('b', null, 6)]);
        const map = await loadJobPriceMap('job1', ['a', 'b']);
        expect(Array.from(map.entries())).toEqual([['a', 8], ['b', 6]]);
        // nessun articolo da importare: nessuna ricerca aggiuntiva
        expect(getMaxPurchasePrices).not.toHaveBeenCalled();
        expect(getByConvertedJobId).not.toHaveBeenCalled();
    });

    it('per gli articoli non ancora importati usa il prezzo più alto registrato negli acquisti', async () => {
        getByJobId.mockResolvedValue([row('a', 8, 9)]);
        getMaxPurchasePrices.mockResolvedValue(new Map([['n', 218.65]]));
        const map = await loadJobPriceMap('job1', ['a', 'n']);
        expect(map.get('n')).toBe(218.65);
        expect(getMaxPurchasePrices).toHaveBeenCalledWith(['n']);
    });

    it('se la commessa viene da un\'offerta, per gli articoli non importati vale prima il prezzo dell\'offerta', async () => {
        getByConvertedJobId.mockResolvedValue({ id: 'prop1' });
        getProposalPriceLookup.mockResolvedValue(new Map([['n', 50]]));
        getMaxPurchasePrices.mockResolvedValue(new Map([['n', 218.65], ['m', 7]]));
        const map = await loadJobPriceMap('job1', ['n', 'm']);
        expect(map.get('n')).toBe(50);   // prezzo dell'offerta
        expect(map.get('m')).toBe(7);    // nessun prezzo di offerta: massimo d'acquisto
    });

    it('un articolo con riga in analisi ma senza prezzi non viene reimportato e mantiene il prezzo del lotto', async () => {
        getByJobId.mockResolvedValue([row('x', null, null)]);
        getMaxPurchasePrices.mockResolvedValue(new Map([['x', 99]]));
        const map = await loadJobPriceMap('job1', ['x']);
        expect(map.has('x')).toBe(false);
        expect(getMaxPurchasePrices).not.toHaveBeenCalled();
    });

    it('un articolo senza alcun prezzo d\'acquisto non compare', async () => {
        const map = await loadJobPriceMap('job1', ['n']);
        expect(map.size).toBe(0);
    });

    it('se la ricerca dei prezzi fallisce restano comunque i prezzi già in analisi', async () => {
        getByJobId.mockResolvedValue([row('a', 8, null)]);
        getByConvertedJobId.mockRejectedValue(new Error('rete'));
        getMaxPurchasePrices.mockRejectedValue(new Error('rete'));
        const map = await loadJobPriceMap('job1', ['a', 'n']);
        expect(Array.from(map.entries())).toEqual([['a', 8]]);
    });

    it('conta una sola volta gli articoli ripetuti nel documento', async () => {
        getMaxPurchasePrices.mockResolvedValue(new Map([['n', 5]]));
        await loadJobPriceMap('job1', ['n', 'n', 'n']);
        expect(getMaxPurchasePrices).toHaveBeenCalledWith(['n']);
    });
});
