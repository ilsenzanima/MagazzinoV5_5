import { supabase } from '@/lib/supabase';
import { costAnalysisApi, CostAnalysisRow } from './cost-analysis';
import { proposalCostAnalysisApi, proposalCostAnalysisVersionsApi, ProposalCostAnalysisVersion } from './proposal-cost-analysis';

// Dove finisce la nuova analisi: in un'offerta, in una commessa (senza offerta) o tra i modelli
export type ArchiveTarget =
    | { kind: 'proposal'; proposalId: string }
    | { kind: 'job'; jobId: string }
    | { kind: 'template' };

export interface CreateFromResult {
    version: ProposalCostAnalysisVersion;
    rowCount: number;
    // Righe con prezzo unitario digitato a mano: non ricalcolate, da ricontrollare
    manualPriceCount: number;
    // Righe il cui prezzo d'acquisto è cambiato rispetto all'analisi di partenza
    refreshedCount: number;
}

const rowKey = (r: CostAnalysisRow) =>
    r.type === 'inventory' && r.itemId ? `inv:${r.itemId}` : `${r.type}:${r.itemName.trim().toLowerCase()}`;

// Unisce le righe di più analisi: stesso articolo / stessa voce → una sola riga con le quantità sommate
export function mergeRows(sources: CostAnalysisRow[][]): CostAnalysisRow[] {
    const merged = new Map<string, CostAnalysisRow>();
    for (const rows of sources) {
        for (const r of rows) {
            const key = rowKey(r);
            const cur = merged.get(key);
            if (!cur) { merged.set(key, { ...r }); continue; }
            cur.qtyEstimated += r.qtyEstimated;
            cur.qtyActual += r.qtyActual;
            if (r.unitPrice !== null && (cur.unitPrice === null || r.unitPrice > cur.unitPrice)) cur.unitPrice = r.unitPrice;
            if (cur.maxPurchasePrice === null) cur.maxPurchasePrice = r.maxPurchasePrice;
        }
    }
    const order = { inventory: 0, generic: 1, transport: 2, posa: 3 } as const;
    return [...merged.values()].sort((a, b) => order[a.type] - order[b.type] || a.sortOrder - b.sortOrder);
}

export const costAnalysisArchiveApi = {
    // Crea una nuova analisi (o modello) partendo da una o più analisi/modelli esistenti.
    // I prezzi d'acquisto di riferimento vengono ricalcolati ad oggi; i prezzi unitari digitati a mano restano.
    createFromVersions: async (
        sourceIds: string[], target: ArchiveTarget, name: string, note?: string | null, refreshPrices = true
    ): Promise<CreateFromResult> => {
        if (sourceIds.length === 0) throw new Error('Nessuna analisi di partenza');
        const [rowsPerSource, paramsPerSource] = await Promise.all([
            Promise.all(sourceIds.map(id => proposalCostAnalysisApi.getByVersionId(id))),
            Promise.all(sourceIds.map(id => proposalCostAnalysisApi.getParams(id))),
        ]);
        const rows = mergeRows(rowsPerSource);

        let refreshedCount = 0;
        if (refreshPrices) {
            const itemIds = [...new Set(rows.filter(r => r.type === 'inventory' && r.itemId).map(r => r.itemId as string))];
            const prices = await costAnalysisApi.getMaxPurchasePrices(itemIds);
            for (const r of rows) {
                if (r.type !== 'inventory' || !r.itemId) continue;
                const fresh = prices.get(r.itemId) ?? null;
                if (fresh !== null && fresh !== r.maxPurchasePrice) refreshedCount++;
                if (fresh !== null) r.maxPurchasePrice = fresh;
            }
        }
        const manualPriceCount = rows.filter(r => r.type === 'inventory' && r.unitPrice !== null).length;

        const proposalId = target.kind === 'proposal' ? target.proposalId : null;
        const jobId = target.kind === 'job' ? target.jobId : null;
        const version = await proposalCostAnalysisVersionsApi.createGeneric(
            { proposalId, jobId, isTemplate: target.kind === 'template' }, name, note, sourceIds[0]
        );

        if (rows.length > 0) {
            const { error } = await supabase.from('proposal_cost_analysis_rows').insert(rows.map((r, idx) => ({
                proposal_id: proposalId,
                version_id: version.id,
                type: r.type,
                item_id: r.itemId || null,
                item_name: r.itemName,
                item_model: r.itemModel,
                item_unit: r.itemUnit,
                max_purchase_price: r.maxPurchasePrice,
                unit_price: r.unitPrice,
                qty_estimated: r.qtyEstimated,
                qty_actual: r.qtyActual,
                sort_order: idx,
            })));
            if (error) throw error;
        }

        // Percentuali dalla prima analisi; Trasporto (A) e Posa (B) sommati (contano solo se non ci sono voci)
        const first = paramsPerSource[0];
        await proposalCostAnalysisApi.upsertParams(proposalId, version.id, {
            sfrido: first.sfrido, sconto: first.sconto, ricarico: first.ricarico, margineTrattativa: first.margineTrattativa,
            trasporto: paramsPerSource.reduce((s, p) => s + p.trasporto, 0),
            posa: paramsPerSource.reduce((s, p) => s + p.posa, 0),
        });

        return { version, rowCount: rows.length, manualPriceCount, refreshedCount };
    },
};
