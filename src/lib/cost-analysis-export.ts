import { format } from 'date-fns';
import { proposalCostAnalysisApi, ProposalCostAnalysisVersion } from '@/lib/services/proposal-cost-analysis';
import { clientsApi } from '@/lib/api';
import type { Client } from '@/lib/types';
import type { CostAnalysisPdfInput } from '@/lib/pdf/cost-analysis-pdf';

// Scarico e stampa rapidi di una o più analisi costi già salvate, senza aprirle.
// Una sola analisi → un solo PDF; più analisi → uno zip con un PDF ciascuno (scarico)
// oppure un unico PDF unito con una sola finestra di stampa.

export interface ExportContext {
    proposalTitle: string;
    clientId?: string | null;
}

// Carica righe, parametri e committente di ogni analisi e le prepara per il PDF
export async function buildExportInputs(
    versions: ProposalCostAnalysisVersion[],
    resolve: (v: ProposalCostAnalysisVersion) => ExportContext
): Promise<CostAnalysisPdfInput[]> {
    const clients = new Map<string, Promise<Client | null>>();
    const getClient = (id: string) => {
        if (!clients.has(id)) clients.set(id, clientsApi.getById(id).catch(() => null));
        return clients.get(id)!;
    };
    return Promise.all(versions.map(async v => {
        const [rows, params] = await Promise.all([
            proposalCostAnalysisApi.getByVersionId(v.id),
            proposalCostAnalysisApi.getParams(v.id),
        ]);
        const ctx = resolve(v);
        const client = ctx.clientId ? await getClient(ctx.clientId) : null;
        return {
            client,
            proposalTitle: ctx.proposalTitle,
            versionName: v.name,
            createdAt: v.createdAt,
            inventoryRows: rows.filter(r => r.type === 'inventory'),
            genericRows: rows.filter(r => r.type === 'generic'),
            transportRows: rows.filter(r => r.type === 'transport'),
            posaRows: rows.filter(r => r.type === 'posa'),
            params,
        };
    }));
}

async function buildPdfs(inputs: CostAnalysisPdfInput[]) {
    const { generateCostAnalysisPdfBlob } = await import('@/lib/pdf/cost-analysis-pdf');
    const out: { blob: Blob; filename: string }[] = [];
    for (const input of inputs) out.push(await generateCostAnalysisPdfBlob(input));
    return out;
}

export async function downloadCostAnalysesPdf(inputs: CostAnalysisPdfInput[]): Promise<void> {
    if (inputs.length === 0) return;
    const { saveBlob } = await import('@/lib/document-actions');
    const pdfs = await buildPdfs(inputs);
    if (pdfs.length === 1) { saveBlob(pdfs[0].blob, pdfs[0].filename); return; }
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const used = new Set<string>();
    for (const p of pdfs) {
        let name = p.filename;
        for (let n = 2; used.has(name); n++) name = p.filename.replace(/(\.[^.]*)?$/, ` (${n})$1`);
        used.add(name);
        zip.file(name, p.blob);
    }
    saveBlob(await zip.generateAsync({ type: 'blob' }), `Analisi costi (${pdfs.length}) - ${format(new Date(), 'yyyyMMdd')}.zip`);
}

export async function printCostAnalysesPdf(inputs: CostAnalysisPdfInput[]): Promise<void> {
    if (inputs.length === 0) return;
    const { printPdfBlob } = await import('@/lib/document-actions');
    const pdfs = await buildPdfs(inputs);
    if (pdfs.length === 1) { void printPdfBlob(pdfs[0].blob).catch(e => console.error("Stampa non riuscita", e)); return; }
    const { PDFDocument } = await import('pdf-lib');
    const out = await PDFDocument.create();
    for (const p of pdfs) {
        const src = await PDFDocument.load(await p.blob.arrayBuffer(), { ignoreEncryption: true });
        (await out.copyPages(src, src.getPageIndices())).forEach(pg => out.addPage(pg));
    }
    void printPdfBlob(new Blob([await out.save() as BlobPart], { type: 'application/pdf' })).catch(e => console.error("Stampa non riuscita", e));
}
