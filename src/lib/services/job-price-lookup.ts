import { costAnalysisApi } from './cost-analysis';
import { clientProposalsApi } from './client-proposals';
import { buildJobPriceMap } from '@/lib/utils/job-prices';

// Prezzi "di commessa" per un elenco di articoli (usati dall'interruttore nel dettaglio movimento).
//
// - Articoli già nell'Analisi Costi della commessa: prezzo impostato, altrimenti prezzo massimo
//   d'acquisto bloccato nella riga (vedi buildJobPriceMap).
// - Articoli entrati in commessa ma non ancora importati nell'analisi (l'import avviene quando si apre
//   la scheda Analisi Costi): lo stesso prezzo con cui verrebbero importati, cioè il prezzo dell'offerta
//   di origine se c'è, altrimenti il prezzo più alto registrato oggi negli acquisti dell'articolo.
// - Articoli senza alcun prezzo disponibile non compaiono: nel documento resta il prezzo del lotto.
export const loadJobPriceMap = async (jobId: string, itemIds: string[]): Promise<Map<string, number>> => {
    const rows = await costAnalysisApi.getByJobId(jobId);
    const map = buildJobPriceMap(rows);

    // Gli articoli che hanno già una riga in analisi non vengono reimportati, anche se la riga non ha prezzi
    const itemsInAnalysis = new Set(rows.map(r => r.itemId).filter((id): id is string => !!id));
    const notImported = Array.from(new Set(itemIds)).filter(id => id && !itemsInAnalysis.has(id));
    if (notImported.length === 0) return map;

    const proposal = await clientProposalsApi.getByConvertedJobId(jobId).catch(() => null);
    const [proposalPrices, maxPrices] = await Promise.all([
        proposal?.id
            ? costAnalysisApi.getProposalPriceLookup(proposal.id).catch(() => new Map<string, number>())
            : Promise.resolve(new Map<string, number>()),
        costAnalysisApi.getMaxPurchasePrices(notImported).catch(() => new Map<string, number>()),
    ]);

    for (const id of notImported) {
        const price = proposalPrices.get(id) ?? maxPrices.get(id);
        if (price !== undefined) map.set(id, price);
    }
    return map;
};
